/**
 * Forward compatibility of the hub's record ingest paths.
 *
 * The hub reads four kinds of JSON record produced by other tools in the
 * toolchain: the handoff manifest, the runner metrics stream, the live
 * sessions file, and the repository posture file. All four are read
 * structurally: each reader picks the keys it knows and ignores everything
 * else. No JSON Schema validator and no `additionalProperties: false` sits in
 * any of those paths, so a producer that grows a new top-level field cannot
 * break a reader.
 *
 * Nothing pinned that. These tests do, so a strict validator cannot later be
 * introduced into an ingest path and silently start rejecting records that a
 * newer producer has extended. Every case runs the same ingest twice, once
 * with a baseline record and once with the identical record plus additive
 * top-level keys, and asserts the ingested result is unchanged.
 *
 * The additive keys used here are the ones AAHP v3.8.0 introduced on its CLI
 * records (`command` on the check record, `mode` on the governance doctor
 * record, alongside an unchanged `schemaVersion: 1`), because those are the
 * concrete additions that prompted the question. The hub does not consume
 * either of those two records today: it invokes the doctor command as a CI
 * gate and reads only its exit code. The property under test is therefore the
 * general one, and it covers those fields the day a reader for them is added.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanProjects, type ProjectSummary } from './manifest';
import { loadMetrics } from './metrics';
import { loadSessions } from './sessions';
import { evaluateRepoPosture } from './posture';
import { UNKNOWN_REMOTE } from './git-remote';

/**
 * The exact additive top-level keys AAHP v3.8.0 introduced, plus one field no
 * producer has shipped yet. A reader that tolerates these tolerates the next
 * additive field too.
 */
const ADDITIVE_KEYS = {
  schemaVersion: 1,
  command: 'check',
  mode: 'governance',
  futureField: { nested: ['not', 'understood', 'by', 'this', 'reader'] },
};

let tmpRoot: string;
const originalRoot = process.env['ROOT_DIR'];
const originalMetrics = process.env['METRICS_FILE'];
const originalSessions = process.env['SESSIONS_FILE'];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aahp-hub-forward-compat-'));
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

/** mtime of the manifest file moves between the two writes; it is not payload. */
function withoutVolatileFields(project: ProjectSummary): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...project };
  delete copy['handoffModifiedAt'];
  return copy;
}

describe('handoff manifest ingest', () => {
  const BASE_MANIFEST = {
    aahp_version: '3.8',
    project: 'sample-service',
    github_repo: 'https://github.com/acme/sample-service.git',
    last_session: {
      agent: 'agent-a',
      timestamp: '2026-01-05T09:00:00Z',
      phase: 'implement',
    },
    quick_context: 'ingest is structural, not schema validated',
    tasks: {
      'T-001': { title: 'one', status: 'ready' },
      'T-002': { title: 'two', status: 'done' },
    },
  };

  async function scanWith(manifest: unknown): Promise<ProjectSummary> {
    const handoffDir = join(tmpRoot, 'sample-service', '.ai', 'handoff');
    mkdirSync(handoffDir, { recursive: true });
    writeFileSync(join(handoffDir, 'MANIFEST.json'), JSON.stringify(manifest), 'utf8');
    const result = await scanProjects();
    expect(result.errors).toEqual([]);
    expect(result.projects).toHaveLength(1);
    return result.projects[0]!;
  }

  it('ignores additive top-level keys instead of rejecting the manifest', async () => {
    const baseline = await scanWith(BASE_MANIFEST);
    const extended = await scanWith({ ...BASE_MANIFEST, ...ADDITIVE_KEYS });

    expect(withoutVolatileFields(extended)).toEqual(withoutVolatileFields(baseline));
    expect(extended.name).toBe('sample-service');
    expect(extended.phase).toBe('implement');
    expect(extended.totalTasks).toBe(2);
  });

  it('ignores additive keys inside a task entry', async () => {
    const baseline = await scanWith(BASE_MANIFEST);
    const extended = await scanWith({
      ...BASE_MANIFEST,
      tasks: {
        'T-001': { title: 'one', status: 'ready', ...ADDITIVE_KEYS },
        'T-002': { title: 'two', status: 'done' },
      },
    });

    expect(withoutVolatileFields(extended)).toEqual(withoutVolatileFields(baseline));
  });
});

describe('runner metrics ingest', () => {
  const BASE_METRIC = {
    timestamp: '2026-01-05T09:00:00Z',
    repo: 'sample-service',
    taskId: 'T-001',
    taskTitle: 'one',
    backend: 'backend-a',
    durationMs: 2000,
    turns: 3,
    success: true,
    committed: true,
  };

  async function loadWith(metric: unknown) {
    writeFileSync(process.env['METRICS_FILE']!, JSON.stringify(metric) + '\n', 'utf8');
    const result = await loadMetrics();
    expect(result.available).toBe(true);
    expect(result.error).toBeNull();
    return result;
  }

  it('ignores additive top-level keys on a metric record', async () => {
    const baseline = await loadWith(BASE_METRIC);
    const extended = await loadWith({ ...BASE_METRIC, ...ADDITIVE_KEYS });

    expect(extended.totals).toEqual(baseline.totals);
    expect(extended.byProject.get('sample-service')).toEqual(
      baseline.byProject.get('sample-service'),
    );
    expect(extended.totals.totalRuns).toBe(1);
  });
});

describe('live sessions ingest', () => {
  const BASE_SESSIONS = {
    updatedAt: '2026-01-05T09:00:00Z',
    controlPort: 41234,
    sessions: [
      {
        repoPath: '/workspace/sample-service',
        repoName: 'sample-service',
        taskId: 'T-001',
        taskTitle: 'one',
        backend: 'backend-a',
        startedAt: '2026-01-05T09:00:00Z',
      },
    ],
  };

  async function loadWith(file: unknown) {
    writeFileSync(process.env['SESSIONS_FILE']!, JSON.stringify(file), 'utf8');
    const result = await loadSessions();
    expect(result.available).toBe(true);
    expect(result.error).toBeNull();
    return result;
  }

  it('ignores additive keys at the file root and inside a session entry', async () => {
    const baseline = await loadWith(BASE_SESSIONS);
    const extended = await loadWith({
      ...BASE_SESSIONS,
      ...ADDITIVE_KEYS,
      sessions: [{ ...BASE_SESSIONS.sessions[0], ...ADDITIVE_KEYS }],
    });

    expect(extended).toEqual(baseline);
    expect(extended.sessions).toHaveLength(1);
    expect(extended.controlPort).toBe(41234);
  });
});

describe('repository posture ingest', () => {
  const BASE_POSTURE = {
    repoName: 'sample-service',
    ecosystem: 'npm',
    lastDependencyScan: '2026-01-05T09:00:00Z',
    supplyChainGuard: {
      status: 'passed',
      lastRun: '2026-01-05T09:00:00Z',
      details: 'scan recorded in the posture file',
    },
    lastDependencyUpdate: '2026-01-04T09:00:00Z',
    openAdvisories: { critical: 0, high: 0, total: 0 },
    permissions: { hasAccess: true, missingPermissions: [] },
  };

  function projectFixture(path: string): ProjectSummary {
    return {
      id: 'fixture',
      name: 'sample-service',
      path,
      phase: 'implement',
      tasks: [],
      activeTasks: [],
      readyTasks: 0,
      inProgressTasks: 0,
      doneTasks: 0,
      totalTasks: 0,
      lastAgent: 'agent-a',
      quickContext: '',
      quickContextSource: 'none',
      lastUpdated: '2026-01-05T09:00:00Z',
      recentlyActive: false,
      githubRepo: 'acme/sample-service',
      remote: UNKNOWN_REMOTE,
      handoffModifiedAt: null,
      metrics: null,
      activeSessions: [],
      worktreeCount: 1,
      alternatePaths: [],
    };
  }

  async function evaluateWith(posture: unknown) {
    const repoPath = join(tmpRoot, 'sample-service');
    mkdirSync(join(repoPath, '.ai'), { recursive: true });
    writeFileSync(join(repoPath, '.ai', 'posture.json'), JSON.stringify(posture), 'utf8');
    return evaluateRepoPosture(projectFixture(repoPath));
  }

  it('ignores additive top-level keys on a posture record', async () => {
    const baseline = await evaluateWith(BASE_POSTURE);
    const extended = await evaluateWith({ ...BASE_POSTURE, ...ADDITIVE_KEYS });

    expect(extended).toEqual(baseline);
    expect(extended.supplyChainGuard.status).toBe('passed');
    expect(extended.permissions.hasAccess).toBe(true);
  });
});
