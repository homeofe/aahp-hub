import 'server-only';
import { spawn } from 'node:child_process';

export interface CommandResult {
  /** Process exit code, or null when the process was killed or never started. */
  code: number | null;
  stdout: string;
  stderr: string;
  /** Set when the binary could not be spawned at all (ENOENT, EACCES, ...). */
  spawnError: NodeJS.ErrnoException | null;
  timedOut: boolean;
}

export interface RunCommandOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
  /** Hard cap on captured stdout, to keep a pathological child from
   *  ballooning the hub's memory. */
  maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

/**
 * Run a binary with an argv array. There is deliberately no shell and no
 * string concatenation anywhere in this path: every dynamic value reaches the
 * child as a discrete argument (or on stdin), so repository names and paths
 * can never be interpreted as shell syntax.
 */
export function runCommand(
  command: string,
  argv: readonly string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  return new Promise<CommandResult>((resolve) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    let child;
    try {
      child = spawn(command, [...argv], {
        cwd: options.cwd,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        code: null,
        stdout: '',
        stderr: '',
        spawnError: err as NodeJS.ErrnoException,
        timedOut: false,
      });
      return;
    }

    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < maxOutputBytes) stdout += chunk;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < maxOutputBytes) stderr += chunk;
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      finish({ code: null, stdout, stderr, spawnError: err, timedOut });
    });

    child.on('close', (code) => {
      finish({ code, stdout, stderr, spawnError: null, timedOut });
    });

    if (options.stdin !== undefined) {
      child.stdin.on('error', () => {
        // The child may exit before draining stdin (for example when gh
        // rejects the request early). Nothing useful to do here.
      });
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}
