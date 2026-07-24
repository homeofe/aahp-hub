import { describe, expect, it, vi } from 'vitest';
import { evaluateRepoPosture } from './posture';
import type { ProjectSummary } from './manifest';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    readFile: vi.fn(async (filePath: string) => {
      if (filePath.includes('healthy-repo')) {
        return JSON.stringify({
          repoName: 'healthy-repo',
          ecosystem: 'npm',
          lastDependencyScan: new Date().toISOString(),
          supplyChainGuard: { status: 'passed', lastRun: new Date().toISOString() },
          openAdvisories: { critical: 0, high: 0, total: 0 },
          permissions: { hasAccess: true, missingPermissions: [] },
        });
      }
      if (filePath.includes('stale-repo')) {
        return JSON.stringify({
          repoName: 'stale-repo',
          ecosystem: 'npm',
          lastDependencyScan: '2020-01-01T00:00:00Z',
          supplyChainGuard: { status: 'stale', lastRun: '2020-01-01T00:00:00Z' },
          openAdvisories: { critical: 1, high: 2, total: 3 },
          permissions: { hasAccess: true, missingPermissions: [] },
        });
      }
      if (filePath.includes('partial-repo')) {
        return JSON.stringify({
          repoName: 'partial-repo',
          ecosystem: 'python',
          lastDependencyScan: new Date().toISOString(),
          supplyChainGuard: { status: 'missing' },
          openAdvisories: { critical: 0, high: 0, total: 0 },
          permissions: { hasAccess: true, missingPermissions: [] },
        });
      }
      if (filePath.includes('forbidden-repo')) {
        const err = new Error('Permission denied') as NodeJS.ErrnoException;
        err.code = 'EACCES';
        throw err;
      }
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }),
    stat: vi.fn(async (filePath: string) => {
      if (filePath.includes('package.json')) return { isFile: () => true };
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }),
  };
});

function createMockProject(name: string, path: string): ProjectSummary {
  return {
    id: name,
    name,
    path,
    phase: 'idle',
    tasks: [],
    activeTasks: [],
    readyTasks: 0,
    inProgressTasks: 0,
    doneTasks: 0,
    totalTasks: 0,
    lastAgent: 'cli-tool',
    quickContext: 'Mock context',
    quickContextSource: 'manifest',
    lastUpdated: new Date().toISOString(),
    recentlyActive: true,
    githubRepo: `homeofe/${name}`,
    metrics: null,
    activeSessions: [],
    worktreeCount: 1,
    alternatePaths: [],
  };
}

describe('evaluateRepoPosture', () => {
  it('evaluates a healthy repository correctly', async () => {
    const project = createMockProject('healthy-repo', '/workspace/healthy-repo');
    const posture = await evaluateRepoPosture(project);

    expect(posture.repoName).toBe('healthy-repo');
    expect(posture.ecosystem).toBe('npm');
    expect(posture.isStale).toBe(false);
    expect(posture.permissions.hasAccess).toBe(true);
    expect(posture.supplyChainGuard.status).toBe('passed');
    expect(posture.openAdvisories.total).toBe(0);
  });

  it('detects stale repository posture data', async () => {
    const project = createMockProject('stale-repo', '/workspace/stale-repo');
    const posture = await evaluateRepoPosture(project);

    expect(posture.repoName).toBe('stale-repo');
    expect(posture.isStale).toBe(true);
    expect(posture.openAdvisories.critical).toBe(1);
    expect(posture.openAdvisories.high).toBe(2);
    expect(posture.staleReason).toBeDefined();
  });

  it('handles partial coverage (missing supply chain guard)', async () => {
    const project = createMockProject('partial-repo', '/workspace/partial-repo');
    const posture = await evaluateRepoPosture(project);

    expect(posture.repoName).toBe('partial-repo');
    expect(posture.ecosystem).toBe('python');
    expect(posture.supplyChainGuard.status).toBe('missing');
    expect(posture.isStale).toBe(true);
    expect(posture.staleReason).toContain('missing');
  });

  it('handles unavailable/permission-denied repositories explicitly', async () => {
    const project = createMockProject('forbidden-repo', '/workspace/forbidden-repo');
    const posture = await evaluateRepoPosture(project);

    expect(posture.permissions.hasAccess).toBe(false);
    expect(posture.permissions.missingPermissions).toContain('read_posture_file');
    expect(posture.isStale).toBe(true);
    expect(posture.staleReason).toContain('Access restricted');
  });
});
