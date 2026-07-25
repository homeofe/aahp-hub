import 'server-only';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { runCommand } from './exec';
import {
  classifyManifestRepo,
  classifyRemoteUrl,
  parseGitConfigRemotes,
  pickRemote,
  UNKNOWN_REMOTE,
  type ProjectRemote,
} from './git-remote';

/**
 * Local-checkout freshness.
 *
 * Every handoff-derived number on this dashboard describes the state of a
 * local working copy. If that copy is 20 commits behind its remote, the whole
 * row is describing yesterday's repository, so "behind" is a first-class
 * signal rather than a footnote.
 *
 * Nothing here touches the network: `git fetch` is never run. The ahead/behind
 * counts come from the remote-tracking refs, which are only as fresh as the
 * last fetch, so `lastFetchAt` is reported alongside them.
 */
export interface CheckoutStatus {
  branch: string | null;
  detached: boolean;
  head: string | null;
  upstream: string | null;
  /** Commits the local branch has that the tracking ref does not. */
  ahead: number | null;
  /** Commits the tracking ref has that the local branch does not. */
  behind: number | null;
  /** Tracked files with uncommitted modifications. */
  dirtyFiles: number;
  /** mtime of .git/FETCH_HEAD: when this checkout last talked to its remote. */
  lastFetchAt: string | null;
  /** Set when git could not be run or the directory is not a checkout. */
  error: string | null;
}

export interface ParsedPorcelainStatus {
  branch: string | null;
  detached: boolean;
  head: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  dirtyFiles: number;
}

const GIT_TIMEOUT_MS = 15_000;

export const EMPTY_CHECKOUT_STATUS: ParsedPorcelainStatus = {
  branch: null,
  detached: false,
  head: null,
  upstream: null,
  ahead: null,
  behind: null,
  dirtyFiles: 0,
};

/**
 * Parse `git status --porcelain=v2 --branch` output.
 *
 * `# branch.ab` is only emitted when the branch has an upstream, so a null
 * ahead/behind pair means "no tracking branch", which is a different signal
 * from "in sync" and is rendered differently.
 */
export function parsePorcelainStatus(text: string): ParsedPorcelainStatus {
  const result: ParsedPorcelainStatus = { ...EMPTY_CHECKOUT_STATUS };

  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue;

    if (line.startsWith('# branch.oid ')) {
      const oid = line.slice('# branch.oid '.length).trim();
      result.head = oid === '(initial)' ? null : oid;
      continue;
    }
    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length).trim();
      if (head === '(detached)') {
        result.detached = true;
        result.branch = null;
      } else {
        result.branch = head;
      }
      continue;
    }
    if (line.startsWith('# branch.upstream ')) {
      result.upstream = line.slice('# branch.upstream '.length).trim();
      continue;
    }
    if (line.startsWith('# branch.ab ')) {
      const counts = line.slice('# branch.ab '.length).trim().match(/^\+(\d+)\s+-(\d+)$/);
      if (counts) {
        result.ahead = Number(counts[1]);
        result.behind = Number(counts[2]);
      }
      continue;
    }
    if (line.startsWith('# ')) continue;

    // 1 = ordinary change, 2 = rename/copy, u = unmerged.
    if (line.startsWith('1 ') || line.startsWith('2 ') || line.startsWith('u ')) {
      result.dirtyFiles += 1;
    }
  }

  return result;
}

/** Resolve `.git` for both plain checkouts and worktrees/submodules. */
async function resolveGitDir(projectPath: string): Promise<{ gitDir: string; commonDir: string } | null> {
  const dotGit = join(/* turbopackIgnore: true */ projectPath, '.git');
  let info;
  try {
    info = await stat(/* turbopackIgnore: true */ dotGit);
  } catch {
    return null;
  }

  let gitDir = dotGit;
  if (!info.isDirectory()) {
    let pointer: string;
    try {
      pointer = await readFile(/* turbopackIgnore: true */ dotGit, 'utf8');
    } catch {
      return null;
    }
    const match = pointer.match(/^gitdir:\s*(.+)$/m);
    if (!match) return null;
    const target = (match[1] ?? '').trim();
    gitDir = isAbsolute(target) ? target : resolve(/* turbopackIgnore: true */ projectPath, target);
  }

  let commonDir = gitDir;
  try {
    const raw = (await readFile(/* turbopackIgnore: true */ join(gitDir, 'commondir'), 'utf8')).trim();
    if (raw.length > 0) {
      commonDir = isAbsolute(raw) ? raw : resolve(/* turbopackIgnore: true */ gitDir, raw);
    }
  } catch {
    // No commondir file: a plain checkout, gitDir is already the common dir.
  }

  return { gitDir, commonDir };
}

/**
 * Read the origin remote straight off disk. Reading `.git/config` avoids one
 * `git` process per project, which matters when the workspace holds fifty of
 * them and the host is Windows.
 */
export async function readProjectRemote(
  projectPath: string,
  declaredInManifest: unknown = null,
): Promise<ProjectRemote> {
  const dirs = await resolveGitDir(projectPath);
  if (!dirs) {
    return classifyManifestRepo(declaredInManifest);
  }

  let config: string;
  try {
    config = await readFile(/* turbopackIgnore: true */ join(dirs.commonDir, 'config'), 'utf8');
  } catch {
    return classifyManifestRepo(declaredInManifest);
  }

  const chosen = pickRemote(parseGitConfigRemotes(config));
  if (!chosen) {
    const fromManifest = classifyManifestRepo(declaredInManifest);
    return fromManifest.kind === 'github' ? fromManifest : UNKNOWN_REMOTE;
  }

  return classifyRemoteUrl(chosen.url, chosen.name);
}

async function readLastFetchAt(projectPath: string): Promise<string | null> {
  const dirs = await resolveGitDir(projectPath);
  if (!dirs) return null;
  for (const candidate of [
    join(/* turbopackIgnore: true */ dirs.gitDir, 'FETCH_HEAD'),
    join(/* turbopackIgnore: true */ dirs.commonDir, 'FETCH_HEAD'),
  ]) {
    try {
      const info = await stat(/* turbopackIgnore: true */ candidate);
      return new Date(info.mtimeMs).toISOString();
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Read the checkout status of one project.
 *
 * `--no-optional-locks` keeps git from taking the index lock, so the hub stays
 * a read-only observer of the scanned working copies.
 */
export async function readCheckoutStatus(projectPath: string): Promise<CheckoutStatus> {
  const [result, lastFetchAt] = await Promise.all([
    runCommand(
      'git',
      ['--no-optional-locks', '-C', projectPath, 'status', '--porcelain=v2', '--branch', '--untracked-files=no'],
      { timeoutMs: GIT_TIMEOUT_MS, maxOutputBytes: 512 * 1024 },
    ),
    readLastFetchAt(projectPath),
  ]);

  if (result.spawnError) {
    const message =
      result.spawnError.code === 'ENOENT'
        ? 'git is not installed or not on PATH'
        : result.spawnError.message;
    return { ...EMPTY_CHECKOUT_STATUS, lastFetchAt, error: message };
  }
  if (result.timedOut) {
    return { ...EMPTY_CHECKOUT_STATUS, lastFetchAt, error: 'git status timed out' };
  }
  if (result.code !== 0) {
    return {
      ...EMPTY_CHECKOUT_STATUS,
      lastFetchAt,
      error: result.stderr.trim().split(/\r?\n/)[0] ?? `git exited with ${String(result.code)}`,
    };
  }

  return { ...parsePorcelainStatus(result.stdout), lastFetchAt, error: null };
}

/** Short-lived memo so a poll every few seconds does not re-spawn git for the
 *  whole workspace. Much shorter than the GitHub TTL: this data is local and
 *  cheap, and drift matters as soon as it appears. */
const CHECKOUT_TTL_MS = 30_000;
const checkoutMemo = new Map<string, { status: CheckoutStatus; at: number }>();

export function resetCheckoutCacheForTests(): void {
  checkoutMemo.clear();
}

/** Run `readCheckoutStatus` over many projects with a bounded worker pool. */
export async function readCheckoutStatuses(
  paths: readonly string[],
  options: { concurrency?: number; force?: boolean } = {},
): Promise<Map<string, CheckoutStatus>> {
  const concurrency = options.concurrency ?? 6;
  const now = Date.now();
  const out = new Map<string, CheckoutStatus>();
  const pending: string[] = [];

  for (const path of paths) {
    const memo = checkoutMemo.get(path);
    if (!options.force && memo && now - memo.at < CHECKOUT_TTL_MS) out.set(path, memo.status);
    else pending.push(path);
  }

  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, pending.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= pending.length) return;
      const path = pending[index];
      if (path === undefined) return;
      const status = await readCheckoutStatus(path);
      checkoutMemo.set(path, { status, at: Date.now() });
      out.set(path, status);
    }
  });

  await Promise.all(workers);
  return out;
}
