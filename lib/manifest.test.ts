import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanProjects } from './manifest';

let tmpRoot: string;
const originalRoot = process.env['ROOT_DIR'];
const originalMetrics = process.env['METRICS_FILE'];
const originalSessions = process.env['SESSIONS_FILE'];

function makeProject(name: string, manifest: unknown): string {
  const projectDir = join(tmpRoot, name);
  const handoffDir = join(projectDir, '.ai', 'handoff');
  mkdirSync(handoffDir, { recursive: true });
  writeFileSync(join(handoffDir, 'MANIFEST.json'), JSON.stringify(manifest), 'utf8');
  return projectDir;
}

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aahp-hub-test-'));
  process.env['ROOT_DIR'] = tmpRoot;
  process.env['METRICS_FILE'] = join(tmpRoot, 'metrics.jsonl');
  process.env['SESSIONS_FILE'] = join(tmpRoot, 'sessions.json');
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  if (originalRoot === undefined) delete process.env['ROOT_DIR'];
  else process.env['ROOT_DIR'] = originalRoot;
  if (originalMetrics === undefined) delete process.env['METRICS_FILE'];
  else process.env['METRICS_FILE'] = originalMetrics;
  if (originalSessions === undefined) delete process.env['SESSIONS_FILE'];
  else process.env['SESSIONS_FILE'] = originalSessions;
});

describe('scanProjects', () => {
  it('returns empty result for an empty root', async () => {
    const result = await scanProjects();
    expect(result.projects).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.rootDir).toBe(tmpRoot);
  });

  it('finds and parses a standard manifest one level deep', async () => {
    makeProject('proj-a', {
      aahp_version: '3.0',
      project: 'proj-a',
      github_repo: 'https://github.com/home/proj-a.git',
      last_session: { agent: 'claude', timestamp: '2026-04-30T00:00:00Z', phase: 'done' },
      quick_context: 'all good',
      tasks: {
        'T-001': { title: 'one', status: 'ready' },
        'T-002': { title: 'two', status: 'in_progress' },
        'T-003': { title: 'three', status: 'done' },
      },
    });

    const result = await scanProjects();
    expect(result.projects).toHaveLength(1);
    const p = result.projects[0]!;
    expect(p.name).toBe('proj-a');
    expect(p.phase).toBe('done');
    expect(p.lastAgent).toBe('claude');
    expect(p.quickContext).toBe('all good');
    expect(p.githubRepo).toBe('home/proj-a');
    expect(p.readyTasks).toBe(1);
    expect(p.inProgressTasks).toBe(1);
    expect(p.doneTasks).toBe(1);
    expect(p.totalTasks).toBe(3);
    expect(p.activeTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'T-001', status: 'ready' }),
        expect.objectContaining({ id: 'T-002', status: 'in_progress' }),
      ]),
    );
  });

  it('falls back to the STATUS summary when the manifest contains placeholder context', async () => {
    const projectDir = makeProject('fallback-project', {
      project: 'fallback-project',
      quick_context: '(no summary available) (no summary available)',
      last_session: {
        agent: 'codex',
        timestamp: new Date().toISOString(),
        phase: 'idle',
      },
    });
    writeFileSync(
      join(projectDir, '.ai', 'handoff', 'STATUS.md'),
      [
        '# Current State',
        '<!-- SECTION: summary -->',
        '## Summary',
        'Fallback project has a complete dashboard and no open formal tasks.',
        '<!-- /SECTION: summary -->',
      ].join('\n'),
      'utf8',
    );

    const result = await scanProjects();
    const project = result.projects[0]!;
    expect(project.quickContext).toBe(
      'Fallback project has a complete dashboard and no open formal tasks.',
    );
    expect(project.quickContextSource).toBe('status');
    expect(project.recentlyActive).toBe(true);
  });
  it('handles a variant manifest (array tasks, object quick_context) without crashing', async () => {
    makeProject('elvatis-defense', {
      version: '3',
      quick_context: {
        project: 'Elvatis Defense',
        stack: 'FastAPI',
        last_session: 'added something',
        active_task: null,
      },
      tasks: [
        { id: 'T-008', title: 'eight', status: 'ready' },
        { id: 'T-009', title: 'nine', status: 'done' },
      ],
    });

    const result = await scanProjects();
    expect(result.errors).toHaveLength(0);
    expect(result.projects).toHaveLength(1);
    const p = result.projects[0]!;
    expect(p.name).toBe('elvatis-defense');
    expect(typeof p.quickContext).toBe('string');
    expect(p.quickContext).toContain('FastAPI');
    expect(p.totalTasks).toBe(2);
    expect(p.readyTasks).toBe(1);
    expect(p.doneTasks).toBe(1);
    expect(p.activeTasks).toEqual([{ id: 'T-008', title: 'eight', status: 'ready' }]);
  });

  it('captures parse errors instead of crashing', async () => {
    const projectDir = join(tmpRoot, 'broken');
    const handoffDir = join(projectDir, '.ai', 'handoff');
    mkdirSync(handoffDir, { recursive: true });
    writeFileSync(join(handoffDir, 'MANIFEST.json'), '{ not valid json', 'utf8');

    const result = await scanProjects();
    expect(result.projects).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.path).toContain('broken');
  });

  it('rejects manifests where the root is not an object', async () => {
    const projectDir = join(tmpRoot, 'string-manifest');
    const handoffDir = join(projectDir, '.ai', 'handoff');
    mkdirSync(handoffDir, { recursive: true });
    writeFileSync(join(handoffDir, 'MANIFEST.json'), '"a string"', 'utf8');

    const result = await scanProjects();
    expect(result.projects).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('walks up to two levels deep but no further', async () => {
    makeProject('top', { project: 'top' });
    const nestedDir = join(tmpRoot, 'group', 'nested');
    mkdirSync(join(nestedDir, '.ai', 'handoff'), { recursive: true });
    writeFileSync(
      join(nestedDir, '.ai', 'handoff', 'MANIFEST.json'),
      JSON.stringify({ project: 'nested' }),
      'utf8',
    );
    const tooDeep = join(tmpRoot, 'a', 'b', 'c');
    mkdirSync(join(tooDeep, '.ai', 'handoff'), { recursive: true });
    writeFileSync(
      join(tooDeep, '.ai', 'handoff', 'MANIFEST.json'),
      JSON.stringify({ project: 'too-deep' }),
      'utf8',
    );

    const result = await scanProjects();
    const names = result.projects.map((p) => p.name).sort();
    expect(names).toEqual(['nested', 'top']);
  });

  it('skips dotfile and node_modules directories', async () => {
    makeProject('keeper', { project: 'keeper' });
    mkdirSync(join(tmpRoot, '.hidden', '.ai', 'handoff'), { recursive: true });
    writeFileSync(
      join(tmpRoot, '.hidden', '.ai', 'handoff', 'MANIFEST.json'),
      JSON.stringify({ project: 'hidden' }),
      'utf8',
    );
    mkdirSync(join(tmpRoot, 'node_modules', 'pkg', '.ai', 'handoff'), { recursive: true });
    writeFileSync(
      join(tmpRoot, 'node_modules', 'pkg', '.ai', 'handoff', 'MANIFEST.json'),
      JSON.stringify({ project: 'pkg' }),
      'utf8',
    );

    const result = await scanProjects();
    const names = result.projects.map((p) => p.name);
    expect(names).toEqual(['keeper']);
  });

  it('sorts projects with running agents to the top', async () => {
    makeProject('idle', {
      project: 'idle',
      last_session: { timestamp: '2026-04-30T10:00:00Z' },
    });
    makeProject('running', {
      project: 'running',
      last_session: { timestamp: '2026-04-29T10:00:00Z' },
    });
    writeFileSync(
      process.env['SESSIONS_FILE']!,
      JSON.stringify({
        updatedAt: '2026-04-30T11:00:00Z',
        sessions: [
          {
            repoPath: join(tmpRoot, 'running'),
            repoName: 'running',
            taskId: 'T-001',
            taskTitle: 'live work',
            backend: 'claude-cli',
            startedAt: '2026-04-30T10:30:00Z',
          },
        ],
      }),
      'utf8',
    );

    const result = await scanProjects();
    expect(result.projects.map((p) => p.name)).toEqual(['running', 'idle']);
    expect(result.projects[0]!.activeSessions).toHaveLength(1);
    expect(result.activeSessions).toHaveLength(1);
    expect(result.orphanSessions).toHaveLength(0);
  });

  it('reports orphan sessions for repos outside ROOT_DIR', async () => {
    makeProject('inside', { project: 'inside' });
    writeFileSync(
      process.env['SESSIONS_FILE']!,
      JSON.stringify({
        sessions: [
          {
            repoPath: '/some/other/path',
            repoName: 'outside',
            taskId: 'T-001',
            taskTitle: 'orphan',
            backend: 'claude-cli',
            startedAt: '2026-04-30T10:30:00Z',
          },
        ],
      }),
      'utf8',
    );

    const result = await scanProjects();
    expect(result.orphanSessions).toHaveLength(1);
    expect(result.orphanSessions[0]!.repoName).toBe('outside');
  });

  it('attaches metrics to matching projects', async () => {
    makeProject('m-proj', { project: 'm-proj' });
    const lines = [
      JSON.stringify({
        timestamp: new Date().toISOString(),
        repo: 'm-proj',
        taskId: 'T-001',
        taskTitle: 'x',
        backend: 'claude-cli',
        durationMs: 2000,
        turns: 3,
        success: true,
        committed: true,
      }),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        repo: 'm-proj',
        taskId: 'T-002',
        taskTitle: 'y',
        backend: 'claude-cli',
        durationMs: 4000,
        turns: 5,
        success: false,
        committed: false,
      }),
    ].join('\n');
    writeFileSync(process.env['METRICS_FILE']!, lines, 'utf8');

    const result = await scanProjects();
    expect(result.projects[0]!.metrics).not.toBeNull();
    expect(result.projects[0]!.metrics!.totalRuns).toBe(2);
    expect(result.projects[0]!.metrics!.successRate).toBe(50);
    expect(result.totals.totalRuns).toBe(2);
  });
});
