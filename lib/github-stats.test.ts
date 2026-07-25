import { describe, expect, it } from 'vitest';
import type { CommandResult } from './exec';
import {
  buildRepoStatsQuery,
  chunk,
  classifyGhFailure,
  fetchRepoStats,
  parseRepoRef,
  parseRepoStatsResponse,
  repoKey,
  type GraphQLRunner,
  type RepoRef,
} from './github-stats';

function aliasesFor(refs: RepoRef[]): Map<string, RepoRef> {
  return buildRepoStatsQuery(refs).aliases;
}

function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return { code: 0, stdout: '', stderr: '', spawnError: null, timedOut: false, ...overrides };
}

function runnerReturning(result: CommandResult): GraphQLRunner {
  return () => Promise.resolve(result);
}

describe('buildRepoStatsQuery', () => {
  it('batches many repositories into a single aliased document', () => {
    const refs: RepoRef[] = [
      { owner: 'acme', name: 'sample-service' },
      { owner: 'homeofe', name: 'aahp-hub' },
      { owner: 'acme', name: 'ai.elvatis.com' },
    ];
    const { query, aliases } = buildRepoStatsQuery(refs);

    expect(aliases.size).toBe(3);
    expect(query).toContain('r0: repository(owner: "acme", name: "sample-service")');
    expect(query).toContain('r2: repository(owner: "acme", name: "ai.elvatis.com")');
    // One document, one rate limit point.
    expect(query.match(/repository\(/g)).toHaveLength(3);
    expect(query).toContain('rateLimit');
  });

  it('asks for OPEN, CLOSED and MERGED pull requests separately', () => {
    const { query } = buildRepoStatsQuery([{ owner: 'a', name: 'b' }]);
    expect(query).toContain('openPullRequests: pullRequests(states: OPEN)');
    expect(query).toContain('mergedPullRequests: pullRequests(states: MERGED)');
    expect(query).toContain('closedPullRequests: pullRequests(states: CLOSED)');
    // Issues and pull requests are separate GraphQL fields, so the REST
    // conflation problem cannot reappear.
    expect(query).toContain('openIssues: issues(states: OPEN)');
    expect(query).toContain('closedIssues: issues(states: CLOSED)');
  });

  it('drops references that fail the strict pattern instead of escaping them', () => {
    const { query, aliases } = buildRepoStatsQuery([
      { owner: 'ok', name: 'fine' },
      { owner: 'bad owner', name: 'x' },
      { owner: 'ok', name: 'in") { id } evil(x: "' },
    ]);
    expect(aliases.size).toBe(1);
    expect(query).not.toContain('evil');
    expect(query).not.toContain('bad owner');
  });
});

describe('parseRepoStatsResponse', () => {
  const refs: RepoRef[] = [
    { owner: 'acme', name: 'sample-service' },
    { owner: 'acme', name: 'gone' },
  ];

  function response(): unknown {
    return {
      data: {
        rateLimit: { cost: 1, remaining: 4849, limit: 5000, resetAt: '2026-07-25T10:00:00Z' },
        r0: {
          nameWithOwner: 'acme/sample-service',
          url: 'https://github.com/acme/sample-service',
          isArchived: false,
          isPrivate: true,
          isFork: false,
          pushedAt: '2026-07-25T08:12:50Z',
          defaultBranchRef: { name: 'main', target: { oid: 'deadbeef' } },
          openIssues: { totalCount: 3 },
          closedIssues: { totalCount: 126 },
          openPullRequests: { totalCount: 0 },
          mergedPullRequests: { totalCount: 30 },
          closedPullRequests: { totalCount: 0 },
          vulnerabilityAlerts: { totalCount: 1 },
        },
        r1: null,
      },
      errors: [
        {
          type: 'NOT_FOUND',
          path: ['r1'],
          message: "Could not resolve to a Repository with the name 'acme/gone'.",
        },
      ],
    };
  }

  it('keeps merged pull requests distinct from closed ones', () => {
    const parsed = parseRepoStatsResponse(response(), aliasesFor(refs));
    const stats = parsed.stats.get('acme/sample-service');
    expect(stats).toBeDefined();
    // The exact trap this dashboard has to avoid: CLOSED excludes merged, so a
    // repository with 30 merged PRs legitimately reports 0 closed.
    expect(stats?.closedPullRequests).toBe(0);
    expect(stats?.mergedPullRequests).toBe(30);
    expect(stats?.openPullRequests).toBe(0);
    expect(stats?.openIssues).toBe(3);
    expect(stats?.closedIssues).toBe(126);
  });

  it('handles a partial failure: data for one alias, an error for another', () => {
    const parsed = parseRepoStatsResponse(response(), aliasesFor(refs));
    expect(parsed.stats.size).toBe(1);
    expect(parsed.repoErrors.get('acme/gone')).toContain('Could not resolve');
    expect(parsed.globalErrors).toEqual([]);
    expect(parsed.rateLimit?.remaining).toBe(4849);
  });

  it('keeps a repository usable when only the alert field failed', () => {
    const body = response() as { data: Record<string, unknown>; errors: unknown[] };
    const repo = body.data['r0'] as Record<string, unknown>;
    repo['vulnerabilityAlerts'] = null;
    body.errors.push({
      path: ['r0', 'vulnerabilityAlerts'],
      message: 'Resource not accessible by integration',
    });

    const parsed = parseRepoStatsResponse(body, aliasesFor(refs));
    const stats = parsed.stats.get('acme/sample-service');
    expect(stats?.openIssues).toBe(3);
    // Unknown, not zero.
    expect(stats?.securityAlerts).toBeNull();
    expect(stats?.partial[0]).toContain('vulnerabilityAlerts');
    expect(parsed.repoErrors.size).toBe(1);
  });

  it('marks alerts unknown when the field is simply absent', () => {
    const body = { data: { r0: { nameWithOwner: 'a/b' } } };
    const parsed = parseRepoStatsResponse(body, aliasesFor([{ owner: 'a', name: 'b' }]));
    expect(parsed.stats.get('a/b')?.securityAlerts).toBeNull();
    expect(parsed.stats.get('a/b')?.openIssues).toBe(0);
  });

  it('reports a null alias with no matching error as a repository error', () => {
    const parsed = parseRepoStatsResponse({ data: { r0: null } }, aliasesFor([{ owner: 'a', name: 'b' }]));
    expect(parsed.stats.size).toBe(0);
    expect(parsed.repoErrors.get('a/b')).toContain('not found');
  });

  it('routes errors without a known alias to global errors', () => {
    const parsed = parseRepoStatsResponse(
      { data: null, errors: [{ message: 'Bad credentials' }] },
      aliasesFor([{ owner: 'a', name: 'b' }]),
    );
    expect(parsed.globalErrors).toEqual(['Bad credentials']);
    expect(parsed.repoErrors.get('a/b')).toBeTruthy();
  });

  it('survives a non-object response', () => {
    const parsed = parseRepoStatsResponse('not json', new Map());
    expect(parsed.globalErrors).toHaveLength(1);
    expect(parsed.stats.size).toBe(0);
  });
});

describe('classifyGhFailure', () => {
  it('detects a missing gh binary', () => {
    const error = Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
    const failure = classifyGhFailure('', error, false);
    expect(failure.kind).toBe('not-installed');
    expect(failure.message).toContain('gh is not installed');
  });

  it('detects an unauthenticated gh', () => {
    const failure = classifyGhFailure('gh: To use GitHub CLI in a GitHub Actions workflow, ... gh auth login', null, false);
    expect(failure.kind).toBe('not-authenticated');
  });

  it('detects HTTP 401 as unauthenticated', () => {
    expect(classifyGhFailure('gh: HTTP 401: Bad credentials', null, false).kind).toBe('not-authenticated');
  });

  it('detects rate limiting and network failures', () => {
    expect(classifyGhFailure('API rate limit exceeded', null, false).kind).toBe('rate-limited');
    expect(classifyGhFailure('dial tcp: lookup api.github.com: no such host', null, false).kind).toBe('network');
  });

  it('reports a timeout distinctly', () => {
    expect(classifyGhFailure('', null, true).kind).toBe('timeout');
  });

  it('falls back to unknown with the raw message', () => {
    expect(classifyGhFailure('something odd', null, false)).toEqual({
      kind: 'unknown',
      message: 'something odd',
    });
  });
});

describe('fetchRepoStats degradation', () => {
  const refs: RepoRef[] = [{ owner: 'homeofe', name: 'aahp-hub' }];

  it('returns no data and a clear reason when gh is not installed', async () => {
    const enoent = Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' });
    const result = await fetchRepoStats(refs, {
      runner: runnerReturning(commandResult({ code: null, spawnError: enoent })),
    });
    expect(result.stats.size).toBe(0);
    expect(result.failures[0]?.kind).toBe('not-installed');
    // No fabricated zeros anywhere.
    expect(result.repoErrors.size).toBe(0);
  });

  it('returns no data and a clear reason when gh is not authenticated', async () => {
    const result = await fetchRepoStats(refs, {
      runner: runnerReturning(
        commandResult({ code: 4, stderr: 'gh: To get started with GitHub CLI, please run: gh auth login' }),
      ),
    });
    expect(result.stats.size).toBe(0);
    expect(result.failures[0]?.kind).toBe('not-authenticated');
  });

  it('still parses the body when gh exits non-zero because of per-alias errors', async () => {
    const body = JSON.stringify({
      data: {
        rateLimit: { cost: 1, remaining: 4849, limit: 5000, resetAt: null },
        r0: {
          nameWithOwner: 'homeofe/aahp-hub',
          openIssues: { totalCount: 3 },
          closedIssues: { totalCount: 10 },
          openPullRequests: { totalCount: 1 },
          mergedPullRequests: { totalCount: 12 },
          closedPullRequests: { totalCount: 2 },
          vulnerabilityAlerts: { totalCount: 0 },
        },
        r1: null,
      },
      errors: [{ path: ['r1'], message: "Could not resolve to a Repository with the name 'x/y'." }],
    });

    const result = await fetchRepoStats([...refs, { owner: 'x', name: 'y' }], {
      runner: runnerReturning(
        commandResult({ code: 1, stdout: body, stderr: 'gh: Could not resolve to a Repository' }),
      ),
    });

    expect(result.stats.get('homeofe/aahp-hub')?.mergedPullRequests).toBe(12);
    expect(result.repoErrors.get('x/y')).toContain('Could not resolve');
    expect(result.failures).toEqual([]);
    expect(result.rateLimit?.remaining).toBe(4849);
  });

  it('splits a large fleet into chunks and keeps the results from every chunk', async () => {
    const many: RepoRef[] = Array.from({ length: 5 }, (_, index) => ({
      owner: 'acme',
      name: `repo-${String(index)}`,
    }));
    const seen: string[] = [];
    const runner: GraphQLRunner = (query) => {
      seen.push(query);
      const aliases = [...query.matchAll(/(r\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\)/g)];
      const data: Record<string, unknown> = {};
      for (const [, alias, owner, name] of aliases) {
        data[String(alias)] = {
          nameWithOwner: `${String(owner)}/${String(name)}`,
          openIssues: { totalCount: 1 },
          vulnerabilityAlerts: { totalCount: 0 },
        };
      }
      return Promise.resolve(commandResult({ stdout: JSON.stringify({ data }) }));
    };

    const result = await fetchRepoStats(many, { chunkSize: 2, runner });
    expect(seen).toHaveLength(3);
    expect(result.stats.size).toBe(5);
  });

  it('does not spawn anything when no project maps to GitHub', async () => {
    let called = false;
    const runner: GraphQLRunner = () => {
      called = true;
      return Promise.resolve(commandResult());
    };
    const result = await fetchRepoStats([], { runner });
    expect(called).toBe(false);
    expect(result.stats.size).toBe(0);
    expect(result.failures).toEqual([]);
  });
});

describe('helpers', () => {
  it('chunks the fleet into bounded batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it('normalises repository keys case-insensitively', () => {
    expect(repoKey({ owner: 'HomeOfE', name: 'AAHP' })).toBe('homeofe/aahp');
  });

  it('parses and validates owner/name strings', () => {
    expect(parseRepoRef('homeofe/aahp-hub')).toEqual({ owner: 'homeofe', name: 'aahp-hub' });
    expect(parseRepoRef('homeofe')).toBeNull();
    expect(parseRepoRef('a/b/c')).toBeNull();
    expect(parseRepoRef('bad owner/repo')).toBeNull();
  });
});
