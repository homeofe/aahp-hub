import 'server-only';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  fetchRepoStats,
  repoKey,
  type GhFailure,
  type RateLimitInfo,
  type RepoRef,
  type RepoStats,
} from './github-stats';

/**
 * TTL cache for the GitHub layer.
 *
 * Two jobs:
 *  1. A page refresh must not re-run the query. The cache is persisted to disk
 *     so it also survives a hub restart.
 *  2. A failed refresh must never turn into zeros. The previous values are
 *     kept and flagged stale, with the age of each value carried alongside it.
 */

export const CACHE_VERSION = 2;
const DEFAULT_TTL_SECONDS = 300;

export interface CachedRepoEntry {
  stats: RepoStats;
  fetchedAt: string;
}

export interface CachedRepoError {
  message: string;
  at: string;
}

export interface GitHubCacheFile {
  version: number;
  updatedAt: string | null;
  repos: Record<string, CachedRepoEntry>;
  repoErrors: Record<string, CachedRepoError>;
  lastFailure: (GhFailure & { at: string }) | null;
  lastSuccessAt: string | null;
  rateLimit: RateLimitInfo | null;
}

export interface GitHubOverviewData {
  entries: Map<string, CachedRepoEntry>;
  repoErrors: Map<string, CachedRepoError>;
  /** When the newest successful refresh completed. */
  lastSuccessAt: string | null;
  /** True when the values on screen are older than the TTL. */
  stale: boolean;
  failure: (GhFailure & { at: string }) | null;
  rateLimit: RateLimitInfo | null;
  source: 'cache' | 'live' | 'stale-cache' | 'empty';
}

export function emptyCache(): GitHubCacheFile {
  return {
    version: CACHE_VERSION,
    updatedAt: null,
    repos: {},
    repoErrors: {},
    lastFailure: null,
    lastSuccessAt: null,
    rateLimit: null,
  };
}

export function ttlMs(): number {
  const raw = process.env['HUB_GITHUB_TTL_SECONDS'];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_SECONDS;
  return seconds * 1000;
}

export function cacheFilePath(): string {
  const explicit = process.env['HUB_GITHUB_CACHE_FILE'];
  if (explicit && explicit.trim().length > 0) return explicit;
  const home = process.env['HOME'] ?? homedir();
  return join(/* turbopackIgnore: true */ home, '.aahp', 'hub-github-cache.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Accept only a cache file this build knows how to read. */
export function parseCacheFile(raw: unknown): GitHubCacheFile {
  if (!isRecord(raw)) return emptyCache();
  if (raw['version'] !== CACHE_VERSION) return emptyCache();

  const repos: Record<string, CachedRepoEntry> = {};
  if (isRecord(raw['repos'])) {
    for (const [key, value] of Object.entries(raw['repos'])) {
      if (!isRecord(value)) continue;
      const stats = value['stats'];
      const fetchedAt = value['fetchedAt'];
      if (!isRecord(stats) || typeof fetchedAt !== 'string') continue;
      repos[key] = { stats: stats as unknown as RepoStats, fetchedAt };
    }
  }

  const repoErrors: Record<string, CachedRepoError> = {};
  if (isRecord(raw['repoErrors'])) {
    for (const [key, value] of Object.entries(raw['repoErrors'])) {
      if (!isRecord(value)) continue;
      if (typeof value['message'] !== 'string' || typeof value['at'] !== 'string') continue;
      repoErrors[key] = { message: value['message'], at: value['at'] };
    }
  }

  return {
    version: CACHE_VERSION,
    updatedAt: typeof raw['updatedAt'] === 'string' ? raw['updatedAt'] : null,
    repos,
    repoErrors,
    lastFailure: isRecord(raw['lastFailure'])
      ? (raw['lastFailure'] as unknown as GhFailure & { at: string })
      : null,
    lastSuccessAt: typeof raw['lastSuccessAt'] === 'string' ? raw['lastSuccessAt'] : null,
    rateLimit: isRecord(raw['rateLimit']) ? (raw['rateLimit'] as unknown as RateLimitInfo) : null,
  };
}

/**
 * A cache is only usable without a refetch when it is inside the TTL AND it
 * already knows about every repository the caller asked for. A newly added
 * project therefore triggers a refresh even if the file is young.
 */
export function isCacheFresh(
  cache: GitHubCacheFile,
  refs: readonly RepoRef[],
  ttl: number,
  now: number = Date.now(),
): boolean {
  if (!cache.updatedAt) return false;
  const updated = Date.parse(cache.updatedAt);
  if (!Number.isFinite(updated) || now - updated >= ttl) return false;
  return refs.every((ref) => {
    const key = repoKey(ref);
    return key in cache.repos || key in cache.repoErrors;
  });
}

export interface FetchOutcome {
  stats: Map<string, RepoStats>;
  repoErrors: Map<string, string>;
  failures: GhFailure[];
  rateLimit: RateLimitInfo | null;
}

/**
 * Fold a fetch result into the previous cache.
 *
 * Repositories that answered get fresh values with a fresh timestamp.
 * Repositories that did not answer keep their previous values and their
 * previous timestamp, so the UI can show exactly how old each row is.
 */
export function mergeFetchIntoCache(
  previous: GitHubCacheFile,
  outcome: FetchOutcome,
  nowIso: string = new Date().toISOString(),
): GitHubCacheFile {
  const repos: Record<string, CachedRepoEntry> = { ...previous.repos };
  const repoErrors: Record<string, CachedRepoError> = { ...previous.repoErrors };

  for (const [key, stats] of outcome.stats) {
    repos[key] = { stats, fetchedAt: nowIso };
    delete repoErrors[key];
  }
  for (const [key, message] of outcome.repoErrors) {
    repoErrors[key] = { message, at: nowIso };
  }

  const anySuccess = outcome.stats.size > 0;
  const failure = outcome.failures[0] ?? null;

  return {
    version: CACHE_VERSION,
    // updatedAt marks the last completed attempt, so a hard failure does not
    // hammer gh on every page refresh.
    updatedAt: nowIso,
    repos,
    repoErrors,
    lastFailure: failure ? { ...failure, at: nowIso } : null,
    lastSuccessAt: anySuccess ? nowIso : previous.lastSuccessAt,
    rateLimit: outcome.rateLimit ?? previous.rateLimit,
  };
}

/** Project the cache into the shape the API route renders. */
export function toOverview(
  cache: GitHubCacheFile,
  refs: readonly RepoRef[],
  ttl: number,
  source: GitHubOverviewData['source'],
  now: number = Date.now(),
): GitHubOverviewData {
  const entries = new Map<string, CachedRepoEntry>();
  const repoErrors = new Map<string, CachedRepoError>();
  for (const ref of refs) {
    const key = repoKey(ref);
    const entry = cache.repos[key];
    if (entry) entries.set(key, entry);
    const error = cache.repoErrors[key];
    if (error) repoErrors.set(key, error);
  }

  const success = cache.lastSuccessAt ? Date.parse(cache.lastSuccessAt) : Number.NaN;
  const stale = !Number.isFinite(success) || now - success >= ttl;

  return {
    entries,
    repoErrors,
    lastSuccessAt: cache.lastSuccessAt,
    stale,
    failure: cache.lastFailure,
    rateLimit: cache.rateLimit,
    source: entries.size === 0 && !cache.lastSuccessAt ? 'empty' : source,
  };
}

async function readCacheFromDisk(): Promise<GitHubCacheFile> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ cacheFilePath(), 'utf8');
    return parseCacheFile(JSON.parse(raw));
  } catch {
    return emptyCache();
  }
}

async function writeCacheToDisk(cache: GitHubCacheFile): Promise<void> {
  const target = cacheFilePath();
  try {
    await mkdir(/* turbopackIgnore: true */ dirname(target), { recursive: true });
    const temp = `${target}.${String(process.pid)}.tmp`;
    await writeFile(/* turbopackIgnore: true */ temp, JSON.stringify(cache, null, 2), 'utf8');
    await rename(/* turbopackIgnore: true */ temp, target);
  } catch {
    // A cache that cannot be persisted is still useful in memory; never let
    // a read-only home directory break the dashboard.
  }
}

/** Process-local mirror so repeated renders inside one TTL avoid disk reads. */
let memoryCache: GitHubCacheFile | null = null;
/** Shared promise so concurrent requests collapse into a single gh call. */
let inFlight: Promise<GitHubCacheFile> | null = null;

export function resetGitHubCacheForTests(): void {
  memoryCache = null;
  inFlight = null;
}

async function loadCache(): Promise<GitHubCacheFile> {
  if (memoryCache) return memoryCache;
  memoryCache = await readCacheFromDisk();
  return memoryCache;
}

/**
 * Return GitHub stats for the given repositories, refreshing at most once per
 * TTL and never returning zeros in place of unavailable data.
 */
export async function getRepoStats(
  refs: readonly RepoRef[],
  options: { force?: boolean } = {},
): Promise<GitHubOverviewData> {
  const ttl = ttlMs();
  const cache = await loadCache();

  if (refs.length === 0) {
    return toOverview(cache, refs, ttl, 'cache');
  }

  if (!options.force && isCacheFresh(cache, refs, ttl)) {
    return toOverview(cache, refs, ttl, 'cache');
  }

  if (!inFlight) {
    inFlight = (async () => {
      const outcome = await fetchRepoStats(refs);
      const merged = mergeFetchIntoCache(cache, outcome);
      memoryCache = merged;
      await writeCacheToDisk(merged);
      return merged;
    })().finally(() => {
      inFlight = null;
    });
  }

  const refreshed = await inFlight;
  const failed = refreshed.lastFailure !== null && refreshed.lastSuccessAt === cache.lastSuccessAt;
  return toOverview(refreshed, refs, ttl, failed ? 'stale-cache' : 'live');
}
