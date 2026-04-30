import 'server-only';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface ActiveSession {
  repoPath: string;
  repoName: string;
  taskId: string;
  taskTitle: string;
  backend: string;
  startedAt: string;
  lastLine: string;
}

export interface SessionsResult {
  sessions: ActiveSession[];
  sessionsFile: string;
  updatedAt: string | null;
  controlPort: number | null;
  available: boolean;
  error: string | null;
}

interface RawSession {
  repoPath?: unknown;
  repoName?: unknown;
  taskId?: unknown;
  taskTitle?: unknown;
  backend?: unknown;
  startedAt?: unknown;
}

interface RawSessionsFile {
  updatedAt?: unknown;
  sessions?: unknown;
  controlPort?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function homeBase(): string {
  return process.env['HOME'] ?? homedir();
}

export function sessionsFilePath(): string {
  const explicit = process.env['SESSIONS_FILE'];
  if (explicit && explicit.trim().length > 0) {
    return explicit;
  }
  return join(homeBase(), '.aahp', 'sessions.json');
}

function logCandidates(repoPath: string, repoName: string): string[] {
  const stamp = new Date().toISOString().slice(0, 10);
  const home = homeBase();
  return [
    join(repoPath, '.ai', 'logs', `${stamp}.log`),
    join(home, '.aahp', 'logs', `${repoName}-${stamp}.log`),
  ];
}

async function readLastLogLine(repoPath: string, repoName: string): Promise<string> {
  for (const candidate of logCandidates(repoPath, repoName)) {
    try {
      const content = await readFile(candidate, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('='));
      const last = lines[lines.length - 1] ?? '';
      return last.replace(/\s+/g, ' ').slice(0, 120);
    } catch {
      // try next candidate
    }
  }
  return '';
}

function coerceSession(raw: unknown): Omit<ActiveSession, 'lastLine'> | null {
  if (!isRecord(raw)) return null;
  const r = raw as RawSession;
  if (
    typeof r.repoPath !== 'string' ||
    typeof r.repoName !== 'string' ||
    typeof r.taskId !== 'string'
  ) {
    return null;
  }
  return {
    repoPath: r.repoPath,
    repoName: r.repoName,
    taskId: r.taskId,
    taskTitle: typeof r.taskTitle === 'string' ? r.taskTitle : '',
    backend: typeof r.backend === 'string' ? r.backend : 'unknown',
    startedAt: typeof r.startedAt === 'string' ? r.startedAt : '',
  };
}

export async function loadSessions(): Promise<SessionsResult> {
  const file = sessionsFilePath();
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {
        sessions: [],
        sessionsFile: file,
        updatedAt: null,
        controlPort: null,
        available: false,
        error: null,
      };
    }
    return {
      sessions: [],
      sessionsFile: file,
      updatedAt: null,
      controlPort: null,
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      sessions: [],
      sessionsFile: file,
      updatedAt: null,
      controlPort: null,
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!isRecord(parsed)) {
    return {
      sessions: [],
      sessionsFile: file,
      updatedAt: null,
      controlPort: null,
      available: true,
      error: 'sessions.json root is not an object',
    };
  }

  const data = parsed as RawSessionsFile;
  const updatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : null;
  const controlPort =
    typeof data.controlPort === 'number' &&
    Number.isInteger(data.controlPort) &&
    data.controlPort > 0 &&
    data.controlPort < 65_536
      ? data.controlPort
      : null;
  const arr = Array.isArray(data.sessions) ? data.sessions : [];

  const sessions: ActiveSession[] = [];
  for (const raw of arr) {
    const base = coerceSession(raw);
    if (!base) continue;
    const lastLine = await readLastLogLine(base.repoPath, base.repoName);
    sessions.push({ ...base, lastLine });
  }

  return {
    sessions,
    sessionsFile: file,
    updatedAt,
    controlPort,
    available: true,
    error: null,
  };
}

/**
 * Read the runner's control port from sessions.json. Returns null when the
 * runner is not currently exposing one (it removes the key on shutdown).
 */
export async function readControlPort(): Promise<number | null> {
  const result = await loadSessions();
  return result.controlPort;
}

export async function watchTargets(): Promise<{ path: string; mtimeMs: number | null }[]> {
  const sessionsFile = sessionsFilePath();
  const home = homeBase();
  const metricsFile = process.env['METRICS_FILE'] ?? join(home, '.aahp', 'metrics.jsonl');
  const targets = [sessionsFile, metricsFile];
  const result: { path: string; mtimeMs: number | null }[] = [];
  for (const p of targets) {
    try {
      const s = await stat(p);
      result.push({ path: p, mtimeMs: s.mtimeMs });
    } catch {
      result.push({ path: p, mtimeMs: null });
    }
  }
  return result;
}
