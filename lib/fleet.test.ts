import { describe, expect, it } from 'vitest';
import type { CheckoutStatus } from './checkout';
import {
  buildFleetRows,
  collectRepoRefs,
  computeAttention,
  computeOffDefaultTip,
  segmentFor,
  type FleetProjectInput,
} from './fleet';
import type { GitHubOverviewData } from './github-cache';
import { classifyRemoteUrl, UNKNOWN_REMOTE } from './git-remote';
import type { RepoStats } from './github-stats';

const NOW = Date.parse('2026-07-25T12:00:00Z');

function stats(overrides: Partial<RepoStats> = {}): RepoStats {
  return {
    nameWithOwner: 'elvatis/elvatis-defense',
    url: 'https://github.com/elvatis/elvatis-defense',
    isArchived: false,
    isPrivate: true,
    isFork: false,
    pushedAt: '2026-07-25T08:12:50Z',
    defaultBranch: 'main',
    defaultBranchOid: 'aaaa',
    openIssues: 3,
    closedIssues: 126,
    openPullRequests: 0,
    mergedPullRequests: 30,
    closedPullRequests: 0,
    securityAlerts: 0,
    partial: [],
    ...overrides,
  };
}

function checkout(overrides: Partial<CheckoutStatus> = {}): CheckoutStatus {
  return {
    branch: 'main',
    detached: false,
    head: 'aaaa',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    dirtyFiles: 0,
    lastFetchAt: '2026-07-25T11:00:00Z',
    error: null,
    ...overrides,
  };
}

function overview(overrides: Partial<GitHubOverviewData> = {}): GitHubOverviewData {
  return {
    entries: new Map(),
    repoErrors: new Map(),
    lastSuccessAt: '2026-07-25T11:59:00Z',
    stale: false,
    failure: null,
    rateLimit: null,
    source: 'live',
    ...overrides,
  };
}

const githubProject: FleetProjectInput = {
  id: 'p1',
  name: 'elvatis-defense',
  path: '/w/elvatis-defense',
  remote: classifyRemoteUrl('https://github.com/elvatis/elvatis-defense.git'),
  handoffModifiedAt: '2026-07-25T09:00:00Z',
};

const forgejoProject: FleetProjectInput = {
  id: 'p2',
  name: 'gaming-llm',
  path: '/w/gaming-llm',
  remote: classifyRemoteUrl('ssh://git@code.home.io:2222/emre/gaming-llm.git'),
  handoffModifiedAt: '2026-07-25T09:00:00Z',
};

const noRemoteProject: FleetProjectInput = {
  id: 'p3',
  name: 'polymarket-homeofe',
  path: '/w/polymarket-homeofe',
  remote: UNKNOWN_REMOTE,
  handoffModifiedAt: null,
};

describe('collectRepoRefs', () => {
  it('asks GitHub only about projects with a GitHub origin', () => {
    expect(collectRepoRefs([githubProject, forgejoProject, noRemoteProject])).toEqual([
      { owner: 'elvatis', name: 'elvatis-defense' },
    ]);
  });

  it('deduplicates repositories shared by several checkouts', () => {
    const duplicate: FleetProjectInput = { ...githubProject, id: 'p1b', path: '/w/elvatis-defense-worktree' };
    expect(collectRepoRefs([githubProject, duplicate])).toHaveLength(1);
  });
});

describe('segmentFor', () => {
  it('splits active, archived and not-applicable', () => {
    expect(segmentFor(githubProject.remote, stats())).toBe('active');
    expect(segmentFor(githubProject.remote, stats({ isArchived: true }))).toBe('archived');
    expect(segmentFor(forgejoProject.remote, null)).toBe('not-applicable');
    expect(segmentFor(noRemoteProject.remote, null)).toBe('not-applicable');
  });

  it('keeps a GitHub project active while its data is still loading', () => {
    expect(segmentFor(githubProject.remote, null)).toBe('active');
  });
});

describe('buildFleetRows', () => {
  it('renders a project with no GitHub remote as not-applicable, never as zeros', () => {
    const rows = buildFleetRows([forgejoProject, noRemoteProject], overview(), new Map(), NOW);
    for (const row of rows) {
      expect(row.segment).toBe('not-applicable');
      expect(row.github).toBeNull();
      expect(row.githubError).toBeNull();
    }
  });

  it('attaches stats and the timestamp they were fetched at', () => {
    const github = overview({
      entries: new Map([
        ['elvatis/elvatis-defense', { stats: stats(), fetchedAt: '2026-07-25T11:59:00Z' }],
      ]),
    });
    const rows = buildFleetRows([githubProject], github, new Map(), NOW);
    expect(rows[0]?.github?.mergedPullRequests).toBe(30);
    expect(rows[0]?.github?.closedPullRequests).toBe(0);
    expect(rows[0]?.githubFetchedAt).toBe('2026-07-25T11:59:00Z');
  });

  it('surfaces a per-repository error without dropping the row', () => {
    const github = overview({
      repoErrors: new Map([['elvatis/elvatis-defense', { message: 'repository renamed', at: 'x' }]]),
    });
    const rows = buildFleetRows([githubProject], github, new Map(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.github).toBeNull();
    expect(rows[0]?.githubError).toBe('repository renamed');
  });

  it('sorts the loudest problems to the top', () => {
    const calm: FleetProjectInput = {
      ...githubProject,
      id: 'calm',
      name: 'aahp-hub',
      path: '/w/aahp-hub',
      remote: classifyRemoteUrl('https://github.com/homeofe/aahp-hub.git'),
    };
    const github = overview({
      entries: new Map([
        ['elvatis/elvatis-defense', { stats: stats({ securityAlerts: 4 }), fetchedAt: 'x' }],
        ['homeofe/aahp-hub', { stats: stats({ securityAlerts: 0 }), fetchedAt: 'x' }],
      ]),
    });
    const rows = buildFleetRows([calm, githubProject], github, new Map(), NOW);
    expect(rows[0]?.name).toBe('elvatis-defense');
  });
});

describe('computeAttention', () => {
  const base = { segment: 'active' as const, githubError: null };

  it('flags open security alerts as the loudest signal', () => {
    const { signals, score } = computeAttention(
      { ...base, github: stats({ securityAlerts: 2 }), checkout: checkout() },
      '2026-07-25T09:00:00Z',
      NOW,
    );
    expect(signals[0]?.kind).toBe('security');
    expect(signals[0]?.level).toBe('high');
    expect(score).toBeGreaterThan(0);
  });

  it('treats a badly behind checkout as a first-class problem', () => {
    const { signals } = computeAttention(
      { ...base, github: stats(), checkout: checkout({ behind: 36 }) },
      '2026-07-25T09:00:00Z',
      NOW,
    );
    const behind = signals.find((signal) => signal.kind === 'behind');
    expect(behind?.level).toBe('high');
    expect(behind?.label).toContain('36');
  });

  it('says nothing at all when everything is clean', () => {
    const { signals, score } = computeAttention(
      { ...base, github: stats(), checkout: checkout() },
      '2026-07-25T09:00:00Z',
      NOW,
    );
    expect(signals).toEqual([]);
    expect(score).toBe(0);
  });

  it('reports a missing upstream instead of pretending the checkout is in sync', () => {
    const { signals } = computeAttention(
      { ...base, github: stats(), checkout: checkout({ upstream: null, ahead: null, behind: null }) },
      '2026-07-25T09:00:00Z',
      NOW,
    );
    expect(signals.map((signal) => signal.kind)).toContain('no-upstream');
  });

  it('does not invent drift signals for a project with no checkout data', () => {
    const { signals } = computeAttention({ ...base, github: null, checkout: null }, null, NOW);
    expect(signals).toEqual([]);
  });

  it('flags a handoff that has not been touched in weeks', () => {
    const { signals } = computeAttention(
      { ...base, github: stats(), checkout: checkout() },
      '2026-06-01T09:00:00Z',
      NOW,
    );
    expect(signals.map((signal) => signal.kind)).toContain('stale-handoff');
  });
});

describe('computeOffDefaultTip', () => {
  it('is true only when the default branch is checked out at a different commit', () => {
    expect(computeOffDefaultTip(checkout({ head: 'bbbb' }), stats())).toBe(true);
    expect(computeOffDefaultTip(checkout({ head: 'aaaa' }), stats())).toBe(false);
  });

  it('is unknown for a feature branch, a detached HEAD or missing data', () => {
    expect(computeOffDefaultTip(checkout({ branch: 'feat/x' }), stats())).toBeNull();
    expect(computeOffDefaultTip(checkout({ detached: true, branch: null }), stats())).toBeNull();
    expect(computeOffDefaultTip(checkout({ error: 'not a checkout' }), stats())).toBeNull();
    expect(computeOffDefaultTip(null, stats())).toBeNull();
    expect(computeOffDefaultTip(checkout(), null)).toBeNull();
  });
});
