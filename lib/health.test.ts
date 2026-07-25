import { describe, expect, it } from 'vitest';
import { computeHealth } from './health';
import { UNKNOWN_REMOTE } from './git-remote';
import type { ProjectSummary } from './manifest';

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'project-id',
    name: 'project',
    path: '/workspace/project',
    phase: 'idle',
    tasks: [],
    activeTasks: [],
    readyTasks: 0,
    inProgressTasks: 0,
    doneTasks: 0,
    totalTasks: 0,
    lastAgent: 'codex',
    quickContext: 'Project roadmap is complete.',
    quickContextSource: 'status',
    lastUpdated: new Date().toISOString(),
    recentlyActive: true,
    githubRepo: null,
    remote: UNKNOWN_REMOTE,
    handoffModifiedAt: null,
    metrics: null,
    activeSessions: [],
    worktreeCount: 1,
    alternatePaths: [],
    ...overrides,
  };
}

describe('computeHealth', () => {
  it('does not penalize projects that have no formal task queue', () => {
    const health = computeHealth(project());
    expect(health.factors.find((factor) => factor.name === 'completion')).toMatchObject({
      score: 100,
      detail: 'no formal tasks recorded',
    });
    expect(health.score).toBe(80);
    expect(health.grade).toBe('B');
  });

  it('still derives completion from recorded tasks', () => {
    const health = computeHealth(project({ totalTasks: 4, doneTasks: 1 }));
    expect(health.factors.find((factor) => factor.name === 'completion')?.score).toBe(25);
  });
});