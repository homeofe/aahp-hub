import 'server-only';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { homedir } from 'node:os';

export interface RunnerStatus {
  available: boolean;
  binary: string | null;
  version: string | null;
  error: string | null;
}

export interface SpawnRunArgs {
  project?: string;
  all?: boolean;
  backend?: string;
  model?: string;
  timeoutMinutes?: number;
  dryRun?: boolean;
}

export interface SpawnRunResult {
  ok: boolean;
  pid: number | null;
  command: string[];
  logFile: string;
  error: string | null;
}

const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;
const BACKEND_PATTERN = /^(auto|claude|gemini|codex|copilot|sdk)$/;
const MODEL_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/;
const VERSION_TIMEOUT_MS = 6000;

const IS_WINDOWS = process.platform === 'win32';
const BINARY_NAME = 'aahp';
const WINDOWS_EXTS = ['.cmd', '.bat', '.exe', ''];

function isWindowsBatch(binary: string): boolean {
  return IS_WINDOWS && /\.(cmd|bat)$/i.test(binary);
}

/**
 * Build the spawn command for a given binary + args. On Windows, .cmd/.bat
 * files cannot be exec'd directly under Node 18+ (EINVAL); they must go
 * through cmd.exe. We invoke cmd.exe explicitly rather than relying on
 * `shell: true` because the latter is deprecated (DEP0190) and concatenates
 * args without escaping. The validated args (regex-checked upstream) cannot
 * contain shell metacharacters.
 */
function spawnArgs(binary: string, argv: string[]): { cmd: string; args: string[] } {
  if (isWindowsBatch(binary)) {
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', binary, ...argv] };
  }
  return { cmd: binary, args: argv };
}

/**
 * Walk PATH and return the absolute path to the first matching aahp binary.
 * On Windows we test `aahp.cmd`, `aahp.bat`, `aahp.exe`, `aahp` in that order.
 * Returns null if not found.
 */
function resolveBinaryFromPath(): string | null {
  const pathVar = process.env['PATH'] ?? '';
  if (!pathVar) return null;
  const exts = IS_WINDOWS ? WINDOWS_EXTS : [''];
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = join(dir, BINARY_NAME + ext);
      try {
        if (existsSync(candidate)) return candidate;
      } catch {
        // ignore inaccessible entries
      }
    }
  }
  return null;
}

/**
 * Try to invoke the binary's --version. Returns the version string on success
 * (any non-zero exit is treated as a detection failure).
 */
function tryBinary(binary: string): { version: string | null; error: string | null } {
  try {
    const { cmd, args } = spawnArgs(binary, ['--version']);
    const result = spawnSync(cmd, args, {
      timeout: VERSION_TIMEOUT_MS,
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
    });
    if (result.error) {
      return { version: null, error: result.error.message };
    }
    if (result.status !== 0) {
      return { version: null, error: `exit ${result.status ?? 'unknown'}` };
    }
    const version = (result.stdout ?? '').trim() || null;
    return { version, error: null };
  } catch (err) {
    return { version: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function detectRunner(): RunnerStatus {
  const errors: string[] = [];

  // Strategy 1: resolve the absolute path on PATH and exec it directly.
  const resolved = resolveBinaryFromPath();
  if (resolved) {
    const { version, error } = tryBinary(resolved);
    if (version !== null) {
      return { available: true, binary: resolved, version, error: null };
    }
    if (error) errors.push(`${resolved}: ${error}`);
  }

  // Strategy 2: rely on PATH resolution by the shell layer (legacy fallback).
  const fallbacks = IS_WINDOWS ? ['aahp.cmd', 'aahp'] : ['aahp'];
  for (const candidate of fallbacks) {
    const { version, error } = tryBinary(candidate);
    if (version !== null) {
      return { available: true, binary: candidate, version, error: null };
    }
    if (error) errors.push(`${candidate}: ${error}`);
  }

  return {
    available: false,
    binary: null,
    version: null,
    error: errors.length > 0 ? errors.join('; ') : 'aahp binary not found on PATH',
  };
}

export function logFileForRunStart(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const home = process.env['HOME'] ?? homedir();
  return join(home, '.aahp', 'logs', `hub-run-${stamp}.log`);
}

function buildArgs(args: SpawnRunArgs): { argv: string[]; error: string | null } {
  const argv: string[] = ['run'];

  if (args.all) {
    argv.push('--all');
  } else if (args.project !== undefined) {
    if (!PROJECT_NAME_PATTERN.test(args.project)) {
      return { argv, error: 'project name contains invalid characters' };
    }
    argv.push(args.project);
  }

  argv.push('--yes');

  if (args.backend !== undefined) {
    if (!BACKEND_PATTERN.test(args.backend)) {
      return { argv, error: 'invalid backend' };
    }
    argv.push('--backend', args.backend);
  }

  if (args.model !== undefined) {
    if (!MODEL_PATTERN.test(args.model)) {
      return { argv, error: 'invalid model' };
    }
    argv.push('--model', args.model);
  }

  if (args.timeoutMinutes !== undefined) {
    if (
      !Number.isInteger(args.timeoutMinutes) ||
      args.timeoutMinutes < 1 ||
      args.timeoutMinutes > 240
    ) {
      return { argv, error: 'timeout out of range (1-240 minutes)' };
    }
    argv.push('--timeout', String(args.timeoutMinutes));
  }

  if (args.dryRun) {
    argv.push('--dry-run');
  }

  return { argv, error: null };
}

/**
 * Validate args without launching the runner. Returns null on success,
 * an error message on rejection.
 */
export function validateRunArgs(args: SpawnRunArgs): string | null {
  if (!args.all && args.project === undefined) {
    return 'either project or all is required';
  }
  if (args.all && args.project !== undefined) {
    return 'pass either project or all, not both';
  }
  return buildArgs(args).error;
}

export function spawnRun(args: SpawnRunArgs): SpawnRunResult {
  const validationError = validateRunArgs(args);
  if (validationError) {
    return {
      ok: false,
      pid: null,
      command: [],
      logFile: '',
      error: validationError,
    };
  }

  const status = detectRunner();
  if (!status.available || !status.binary) {
    return {
      ok: false,
      pid: null,
      command: [],
      logFile: '',
      error: status.error ?? 'aahp not available',
    };
  }

  const { argv } = buildArgs(args);
  const logFile = logFileForRunStart();
  const { cmd, args: spawned } = spawnArgs(status.binary, argv);
  try {
    const proc = spawn(cmd, spawned, {
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    proc.on('error', () => {
      // detached child emitted an error after spawn; nothing we can do here
    });
    proc.unref();
    return {
      ok: true,
      pid: proc.pid ?? null,
      command: [status.binary, ...argv],
      logFile,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      pid: null,
      command: [status.binary, ...argv],
      logFile,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
