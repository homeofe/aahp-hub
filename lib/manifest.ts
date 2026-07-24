import 'server-only';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeGitHubRepo } from './project-links';
import { loadMetrics, type MetricsResult, type ProjectMetrics } from './metrics';
import { detectRunner, type RunnerStatus } from './runner';
import { loadSessions, type ActiveSession } from './sessions';

export type TaskStatus = 'ready' | 'in_progress' | 'done' | 'blocked' | string;

export interface ManifestTask {
  title: string;
  status: TaskStatus;
  priority?: string;
  depends_on?: string[];
  github_issue?: number;
  github_repo?: string;
  notes?: string;
}

export interface ManifestLastSession {
  agent?: string;
  session_id?: string;
  timestamp?: string;
  commit?: string;
  phase?: string;
  duration_minutes?: number;
}

export interface RawManifest {
  aahp_version?: unknown;
  project?: unknown;
  github_repo?: unknown;
  last_session?: unknown;
  quick_context?: unknown;
  tasks?: unknown;
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  phase: string;
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority?: string;
    dependsOn?: string[];
    githubIssue?: number;
  }>;
  activeTasks: { id: string; title: string; status: TaskStatus }[];
  readyTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  totalTasks: number;
  lastAgent: string;
  quickContext: string;
  quickContextSource: 'manifest' | 'status' | 'none';
  lastUpdated: string;
  recentlyActive: boolean;
  githubRepo: string | null;
  metrics: ProjectMetrics | null;
  activeSessions: ActiveSession[];
  worktreeCount: number;
  alternatePaths: string[];
}

export interface StubProject {
  name: string;
  path: string;
}

export interface ScanResult {
  projects: ProjectSummary[];
  stubs: StubProject[];
  errors: { path: string; message: string }[];
  rootDir: string | null;
  scannedAt: string;
  metricsFile: string;
  metricsAvailable: boolean;
  metricsError: string | null;
  totals: MetricsResult['totals'];
  activeSessions: ActiveSession[];
  sessionsFile: string;
  sessionsAvailable: boolean;
  sessionsError: string | null;
  orphanSessions: ActiveSession[];
  controlPort: number | null;
  runner: RunnerStatus;
}

const MANIFEST_REL_PATH = ['.ai', 'handoff', 'MANIFEST.json'];
const MAX_DEPTH = 2;

function resolveRootDir(): string | null {
  const explicit = process.env['ROOT_DIR'];
  if (explicit && explicit.trim().length > 0) {
    return explicit;
  }
  const home = process.env['HOME'] ?? homedir();
  if (!home) {
    return null;
  }
  return join(/* turbopackIgnore: true */ home, 'Workspace');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseManifest(raw: string): RawManifest {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error('Manifest is not an object');
  }
  return parsed as RawManifest;
}

async function findManifests(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) {
      return;
    }
    let entries;
    try {
      entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true });
    } catch {
      return;
    }
    const candidate = join(/* turbopackIgnore: true */ dir, ...MANIFEST_REL_PATH);
    try {
      const s = await stat(/* turbopackIgnore: true */ candidate);
      if (s.isFile()) {
        found.push(candidate);
        return;
      }
    } catch {
      // not a project root, keep walking
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      await walk(join(/* turbopackIgnore: true */ dir, entry.name), depth + 1);
    }
  }

  await walk(root, 0);
  return found;
}

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function normaliseTasks(raw: unknown): [string, ManifestTask][] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const entries: [string, ManifestTask][] = [];
    for (const [i, item] of raw.entries()) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const id = typeof obj['id'] === 'string' ? obj['id'] : `T-${String(i).padStart(3, '0')}`;
      entries.push([
        id,
        {
          title: coerceString(obj['title']),
          status: typeof obj['status'] === 'string' ? obj['status'] : 'unknown',
          priority: typeof obj['priority'] === 'string' ? obj['priority'] : undefined,
          depends_on: Array.isArray(obj['depends_on'])
            ? obj['depends_on'].filter((item): item is string => typeof item === 'string')
            : undefined,
          github_issue: typeof obj['github_issue'] === 'number' ? obj['github_issue'] : undefined,
        },
      ]);
    }
    return entries;
  }
  if (typeof raw === 'object') {
    const entries: [string, ManifestTask][] = [];
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const obj = value as Record<string, unknown>;
      entries.push([
        id,
        {
          title: coerceString(obj['title']),
          status: typeof obj['status'] === 'string' ? obj['status'] : 'unknown',
          priority: typeof obj['priority'] === 'string' ? obj['priority'] : undefined,
          depends_on: Array.isArray(obj['depends_on'])
            ? obj['depends_on'].filter((item): item is string => typeof item === 'string')
            : undefined,
          github_issue: typeof obj['github_issue'] === 'number' ? obj['github_issue'] : undefined,
        },
      ]);
    }
    return entries;
  }
  return [];
}

const RECENT_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
const SUMMARY_PLACEHOLDER_PATTERN = /\(?no summary available\)?/gi;

function hasMeaningfulContext(value: string): boolean {
  return value.replace(SUMMARY_PLACEHOLDER_PATTERN, '').trim().length > 0;
}

function extractStatusSummary(markdown: string): string | null {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const section = normalized.match(
    /<!--\s*SECTION:\s*summary\s*-->([\s\S]*?)<!--\s*\/SECTION:\s*summary\s*-->/i,
  )?.[1];
  if (!section) return null;

  const summary = section
    .replace(/^\s*##\s+Summary\s*$/gim, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return summary.length > 0 ? summary : null;
}

async function loadStatusSummary(manifestPath: string): Promise<string | null> {
  const statusPath = join(
    /* turbopackIgnore: true */ dirname(manifestPath),
    'STATUS.md',
  );
  try {
    return extractStatusSummary(
      await readFile(/* turbopackIgnore: true */ statusPath, 'utf8'),
    );
  } catch {
    return null;
  }
}

function isRecentlyActive(lastUpdated: string, metrics: ProjectMetrics | null): boolean {
  const cutoff = Date.now() - RECENT_ACTIVITY_MS;
  return [lastUpdated, metrics?.lastRunAt ?? ''].some((value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

const WORKTREE_COPY_PATTERN = /(?:^|[\\/])[^\\/]*(?:temp|backup|copy|archive|old)(?:[^\\/]*)?(?:[\\/]|$)/i;

function canonicalProjectScore(project: ProjectSummary): number {
  const leaf = project.path.split(/[\\/]/).at(-1)?.toLowerCase() ?? '';
  const projectName = project.name.toLowerCase();
  let score = leaf === projectName ? 100 : 0;
  if (project.githubRepo) score += 30;
  if (hasMeaningfulContext(project.quickContext)) score += 20;
  if (project.totalTasks > 0) score += 10;
  if (WORKTREE_COPY_PATTERN.test(project.path)) score -= 200;
  return score;
}

function deduplicateProjects(projects: ProjectSummary[]): ProjectSummary[] {
  const groups = new Map<string, ProjectSummary[]>();
  for (const project of projects) {
    const key = project.name.trim().toLocaleLowerCase();
    const group = groups.get(key);
    if (group) group.push(project);
    else groups.set(key, [project]);
  }

  return [...groups.values()].map((group) => {
    const ranked = [...group].sort((a, b) => {
      const scoreDifference = canonicalProjectScore(b) - canonicalProjectScore(a);
      if (scoreDifference !== 0) return scoreDifference;
      const updatedDifference = (Date.parse(b.lastUpdated) || 0) - (Date.parse(a.lastUpdated) || 0);
      if (updatedDifference !== 0) return updatedDifference;
      const depthDifference = a.path.split(/[\\/]/).length - b.path.split(/[\\/]/).length;
      if (depthDifference !== 0) return depthDifference;
      return a.path.localeCompare(b.path);
    });
    const canonical = ranked[0]!;
    canonical.worktreeCount = ranked.length;
    canonical.alternatePaths = ranked.slice(1).map((project) => project.path);
    return canonical;
  });
}
function summarize(
  manifestPath: string,
  manifest: RawManifest,
  metricsByProject: Map<string, ProjectMetrics>,
  sessionsByProject: Map<string, ActiveSession[]>,
): ProjectSummary {
  const projectPath = manifestPath.replace(/[\\/]\.ai[\\/]handoff[\\/]MANIFEST\.json$/, '');
  const projectField = typeof manifest.project === 'string' ? manifest.project : null;
  const name = projectField ?? projectPath.split(/[\\/]/).pop() ?? 'unknown';
  const taskEntries = normaliseTasks(manifest.tasks);

  const tasks = taskEntries.map(([id, task]) => ({
    id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dependsOn: task.depends_on,
    githubIssue: task.github_issue,
  }));
  const active = tasks
    .filter((task) => task.status === 'in_progress' || task.status === 'ready')
    .map(({ id, title, status }) => ({ id, title, status }));

  const ready = taskEntries.filter(([, t]) => t.status === 'ready').length;
  const inProgress = taskEntries.filter(([, t]) => t.status === 'in_progress').length;
  const done = taskEntries.filter(([, t]) => t.status === 'done').length;

  const lastSession = isRecord(manifest.last_session) ? manifest.last_session : null;
  const phase = lastSession ? coerceString(lastSession['phase'], 'unknown') : 'unknown';
  const lastAgent = lastSession ? coerceString(lastSession['agent'], 'unknown') : 'unknown';
  const lastUpdated = lastSession ? coerceString(lastSession['timestamp']) : '';

  const githubRepo = normalizeGitHubRepo(manifest.github_repo);
  const projectMetrics = metricsByProject.get(name) ?? null;
  const quickContext = coerceString(manifest.quick_context);

  return {
    id: createHash('sha256').update(projectPath).digest('hex').slice(0, 12),
    name,
    path: projectPath,
    phase,
    tasks,
    activeTasks: active,
    readyTasks: ready,
    inProgressTasks: inProgress,
    doneTasks: done,
    totalTasks: taskEntries.length,
    lastAgent,
    quickContext,
    quickContextSource: hasMeaningfulContext(quickContext) ? 'manifest' : 'none',
    lastUpdated,
    recentlyActive: isRecentlyActive(lastUpdated, projectMetrics),
    githubRepo,
    metrics: projectMetrics,
    activeSessions: sessionsByProject.get(name) ?? [],
    worktreeCount: 1,
    alternatePaths: [],
  };
}

export async function scanProjects(): Promise<ScanResult> {
  const rootDir = resolveRootDir();
  const scannedAt = new Date().toISOString();

  const [metrics, sessionsRes] = await Promise.all([loadMetrics(), loadSessions()]);
  const runner = detectRunner();

  const sessionsByProject = new Map<string, ActiveSession[]>();
  for (const s of sessionsRes.sessions) {
    const bucket = sessionsByProject.get(s.repoName);
    if (bucket) bucket.push(s);
    else sessionsByProject.set(s.repoName, [s]);
  }

  const metricsMeta = {
    metricsFile: metrics.metricsFile,
    metricsAvailable: metrics.available,
    metricsError: metrics.error,
    totals: metrics.totals,
    activeSessions: sessionsRes.sessions,
    sessionsFile: sessionsRes.sessionsFile,
    sessionsAvailable: sessionsRes.available,
    sessionsError: sessionsRes.error,
    controlPort: sessionsRes.controlPort,
    runner,
  };

  if (!rootDir) {
    return {
      projects: [],
      errors: [],
      rootDir: null,
      scannedAt,
      orphanSessions: sessionsRes.sessions,
      stubs: [],
      ...metricsMeta,
    };
  }

  const errors: { path: string; message: string }[] = [];
  let manifestPaths: string[] = [];
  try {
    manifestPaths = await findManifests(rootDir);
  } catch (err) {
    errors.push({ path: rootDir, message: err instanceof Error ? err.message : String(err) });
    return {
      projects: [],
      errors,
      rootDir,
      scannedAt,
      orphanSessions: sessionsRes.sessions,
      stubs: [],
      ...metricsMeta,
    };
  }

  const projects: ProjectSummary[] = [];
  const stubs: StubProject[] = [];
  for (const manifestPath of manifestPaths) {
    try {
      const raw = await readFile(/* turbopackIgnore: true */ manifestPath, 'utf8');
      const manifest = parseManifest(raw);
      const summary = summarize(manifestPath, manifest, metrics.byProject, sessionsByProject);
      if (!hasMeaningfulContext(summary.quickContext)) {
        const statusSummary = await loadStatusSummary(manifestPath);
        summary.quickContext = statusSummary ?? '';
        summary.quickContextSource = statusSummary ? 'status' : 'none';
      }
      if (isStubProject(summary)) {
        stubs.push({ name: summary.name, path: summary.path });
      } else {
        projects.push(summary);
      }
    } catch (err) {
      errors.push({
        path: manifestPath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  projects.splice(0, projects.length, ...deduplicateProjects(projects));

  projects.sort((a, b) => {
    const aActive = a.activeSessions.length > 0 ? 0 : 1;
    const bActive = b.activeSessions.length > 0 ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  stubs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const projectNames = new Set(projects.map((p) => p.name));
  const orphanSessions = sessionsRes.sessions.filter((s) => !projectNames.has(s.repoName));

  return {
    projects,
    stubs,
    errors,
    rootDir,
    scannedAt,
    orphanSessions,
    ...metricsMeta,
  };
}

const STUB_NAME_PATTERN = /^\[.*\]$/;
const STUB_TASK_TITLE_PATTERN = /^example: /i;

function isStubProject(p: ProjectSummary): boolean {
  if (STUB_NAME_PATTERN.test(p.name)) return true;
  if (p.name.toLowerCase() === 'project' && p.totalTasks <= 1) {
    if (
      p.activeTasks.length > 0 &&
      STUB_TASK_TITLE_PATTERN.test(p.activeTasks[0]!.title)
    ) {
      return true;
    }
  }
  return false;
}

export function rootDirIsConfigured(): boolean {
  const explicit = process.env['ROOT_DIR'];
  return Boolean(explicit && explicit.trim().length > 0);
}
