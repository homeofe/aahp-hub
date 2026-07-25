import { describe, expect, it } from 'vitest';
import {
  CACHE_VERSION,
  emptyCache,
  isCacheFresh,
  mergeFetchIntoCache,
  parseCacheFile,
  toOverview,
  type FetchOutcome,
  type GitHubCacheFile,
} from './github-cache';
import type { RepoRef, RepoStats } from './github-stats';

function stats(overrides: Partial<RepoStats> = {}): RepoStats {
  return {
    nameWithOwner: 'elvatis/elvatis-defense',
    url: 'https://github.com/elvatis/elvatis-defense',
    isArchived: false,
    isPrivate: true,
    isFork: false,
    pushedAt: '2026-07-25T08:12:50Z',
    defaultBranch: 'main',
    defaultBranchOid: 'deadbeef',
    openIssues: 3,
    closedIssues: 126,
    openPullRequests: 0,
    mergedPullRequests: 30,
    closedPullRequests: 0,
    securityAlerts: 1,
    partial: [],
    ...overrides,
  };
}

const refs: RepoRef[] = [{ owner: 'elvatis', name: 'elvatis-defense' }];

function outcome(overrides: Partial<FetchOutcome> = {}): FetchOutcome {
  return {
    stats: new Map(),
    repoErrors: new Map(),
    failures: [],
    rateLimit: null,
    ...overrides,
  };
}

describe('isCacheFresh', () => {
  const cache: GitHubCacheFile = {
    ...emptyCache(),
    updatedAt: '2026-07-25T10:00:00Z',
    repos: { 'elvatis/elvatis-defense': { stats: stats(), fetchedAt: '2026-07-25T10:00:00Z' } },
  };
  const base = Date.parse('2026-07-25T10:00:00Z');

  it('is fresh inside the TTL', () => {
    expect(isCacheFresh(cache, refs, 300_000, base + 60_000)).toBe(true);
  });

  it('expires after the TTL', () => {
    expect(isCacheFresh(cache, refs, 300_000, base + 300_001)).toBe(false);
  });

  it('is not fresh when a newly scanned project is missing from it', () => {
    const withNewProject = [...refs, { owner: 'homeofe', name: 'aahp-hub' }];
    expect(isCacheFresh(cache, withNewProject, 300_000, base + 1000)).toBe(false);
  });

  it('counts a recorded per-repository error as covered', () => {
    const withError: GitHubCacheFile = {
      ...cache,
      repoErrors: { 'homeofe/aahp-hub': { message: 'gone', at: '2026-07-25T10:00:00Z' } },
    };
    expect(isCacheFresh(withError, [...refs, { owner: 'homeofe', name: 'aahp-hub' }], 300_000, base + 1000)).toBe(true);
  });

  it('is never fresh without a previous attempt', () => {
    expect(isCacheFresh(emptyCache(), refs, 300_000)).toBe(false);
  });
});

describe('mergeFetchIntoCache', () => {
  const previous: GitHubCacheFile = {
    ...emptyCache(),
    updatedAt: '2026-07-25T09:00:00Z',
    lastSuccessAt: '2026-07-25T09:00:00Z',
    repos: { 'elvatis/elvatis-defense': { stats: stats(), fetchedAt: '2026-07-25T09:00:00Z' } },
  };

  it('keeps the last good values when the refresh fails completely', () => {
    const merged = mergeFetchIntoCache(
      previous,
      outcome({ failures: [{ kind: 'network', message: 'GitHub is unreachable' }] }),
      '2026-07-25T10:00:00Z',
    );

    const entry = merged.repos['elvatis/elvatis-defense'];
    // The critical property: no zeros, and the old timestamp is preserved so
    // the row can be marked stale rather than silently wrong.
    expect(entry?.stats.mergedPullRequests).toBe(30);
    expect(entry?.fetchedAt).toBe('2026-07-25T09:00:00Z');
    expect(merged.lastSuccessAt).toBe('2026-07-25T09:00:00Z');
    expect(merged.lastFailure?.kind).toBe('network');
  });

  it('replaces values and timestamps for repositories that answered', () => {
    const merged = mergeFetchIntoCache(
      previous,
      outcome({
        stats: new Map([['elvatis/elvatis-defense', stats({ openIssues: 7, mergedPullRequests: 31 })]]),
        rateLimit: { cost: 1, remaining: 4900, limit: 5000, resetAt: null },
      }),
      '2026-07-25T10:00:00Z',
    );

    expect(merged.repos['elvatis/elvatis-defense']?.stats.openIssues).toBe(7);
    expect(merged.repos['elvatis/elvatis-defense']?.fetchedAt).toBe('2026-07-25T10:00:00Z');
    expect(merged.lastSuccessAt).toBe('2026-07-25T10:00:00Z');
    expect(merged.lastFailure).toBeNull();
    expect(merged.rateLimit?.remaining).toBe(4900);
  });

  it('clears a stale per-repository error once the repository answers again', () => {
    const withError: GitHubCacheFile = {
      ...previous,
      repoErrors: { 'elvatis/elvatis-defense': { message: 'gone', at: '2026-07-25T09:00:00Z' } },
    };
    const merged = mergeFetchIntoCache(
      withError,
      outcome({ stats: new Map([['elvatis/elvatis-defense', stats()]]) }),
      '2026-07-25T10:00:00Z',
    );
    expect(merged.repoErrors['elvatis/elvatis-defense']).toBeUndefined();
  });
});

describe('toOverview', () => {
  const base = Date.parse('2026-07-25T10:00:00Z');
  const cache: GitHubCacheFile = {
    ...emptyCache(),
    updatedAt: '2026-07-25T10:00:00Z',
    lastSuccessAt: '2026-07-25T10:00:00Z',
    repos: { 'elvatis/elvatis-defense': { stats: stats(), fetchedAt: '2026-07-25T10:00:00Z' } },
  };

  it('projects only the requested repositories', () => {
    const overview = toOverview(cache, refs, 300_000, 'cache', base + 1000);
    expect(overview.entries.size).toBe(1);
    expect(overview.stale).toBe(false);
  });

  it('marks values stale once the last success is older than the TTL', () => {
    const overview = toOverview(cache, refs, 300_000, 'stale-cache', base + 400_000);
    expect(overview.stale).toBe(true);
    expect(overview.entries.get('elvatis/elvatis-defense')?.stats.openIssues).toBe(3);
  });

  it('reports an empty source when nothing has ever been fetched', () => {
    const overview = toOverview(emptyCache(), refs, 300_000, 'cache', base);
    expect(overview.source).toBe('empty');
    expect(overview.entries.size).toBe(0);
    expect(overview.stale).toBe(true);
  });
});

describe('parseCacheFile', () => {
  it('rejects a cache written by a different version', () => {
    expect(parseCacheFile({ version: CACHE_VERSION - 1, repos: { a: 1 } }).repos).toEqual({});
  });

  it('rejects malformed entries without throwing', () => {
    const parsed = parseCacheFile({
      version: CACHE_VERSION,
      updatedAt: 5,
      repos: { good: { stats: {}, fetchedAt: 'x' }, bad: { stats: 'nope' }, alsoBad: null },
      repoErrors: { one: { message: 'm', at: 'a' }, two: { message: 4 } },
    });
    expect(Object.keys(parsed.repos)).toEqual(['good']);
    expect(Object.keys(parsed.repoErrors)).toEqual(['one']);
    expect(parsed.updatedAt).toBeNull();
  });

  it('returns an empty cache for junk input', () => {
    expect(parseCacheFile(null)).toEqual(emptyCache());
    expect(parseCacheFile('nope')).toEqual(emptyCache());
  });
});
