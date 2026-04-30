import 'server-only';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadMetrics, type ProjectMetrics } from './metrics';

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
  aahp_version?: string;
  project?: string;
  github_repo?: string;
  last_session?: ManifestLastSession;
  quick_context?: string;
  tasks?: Record<string, ManifestTask>;
}

export interface ProjectSummary {
  name: string;
  path: string;
  phase: string;
  activeTasks: { id: string; title: string; status: TaskStatus }[];
  readyTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  totalTasks: number;
  lastAgent: string;
  quickContext: string;
  lastUpdated: string;
  githubRepo: string | null;
  metrics: ProjectMetrics | null;
}

export interface ScanResult {
  projects: ProjectSummary[];
  errors: { path: string; message: string }[];
  rootDir: string | null;
  scannedAt: string;
  metricsFile: string;
  metricsAvailable: boolean;
  metricsError: string | null;
  totals: {
    totalRuns: number;
    runs24h: number;
    runs7d: number;
    successRate: number;
  };
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
  return join(home, 'Workspace');
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
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const candidate = join(dir, ...MANIFEST_REL_PATH);
    try {
      const s = await stat(candidate);
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
      await walk(join(dir, entry.name), depth + 1);
    }
  }

  await walk(root, 0);
  return found;
}

function summarize(
  manifestPath: string,
  manifest: RawManifest,
  metricsByProject: Map<string, ProjectMetrics>,
): ProjectSummary {
  const projectPath = manifestPath.replace(/[\\/]\.ai[\\/]handoff[\\/]MANIFEST\.json$/, '');
  const name = manifest.project ?? projectPath.split(/[\\/]/).pop() ?? 'unknown';
  const tasks = manifest.tasks ?? {};
  const taskEntries = Object.entries(tasks);

  const active = taskEntries
    .filter(([, t]) => t.status === 'in_progress' || t.status === 'ready')
    .map(([id, t]) => ({ id, title: t.title, status: t.status }));

  const ready = taskEntries.filter(([, t]) => t.status === 'ready').length;
  const inProgress = taskEntries.filter(([, t]) => t.status === 'in_progress').length;
  const done = taskEntries.filter(([, t]) => t.status === 'done').length;

  return {
    name,
    path: projectPath,
    phase: manifest.last_session?.phase ?? 'unknown',
    activeTasks: active,
    readyTasks: ready,
    inProgressTasks: inProgress,
    doneTasks: done,
    totalTasks: taskEntries.length,
    lastAgent: manifest.last_session?.agent ?? 'unknown',
    quickContext: manifest.quick_context ?? '',
    lastUpdated: manifest.last_session?.timestamp ?? '',
    githubRepo: manifest.github_repo ?? null,
    metrics: metricsByProject.get(name) ?? null,
  };
}

export async function scanProjects(): Promise<ScanResult> {
  const rootDir = resolveRootDir();
  const scannedAt = new Date().toISOString();
  const metrics = await loadMetrics();
  const metricsMeta = {
    metricsFile: metrics.metricsFile,
    metricsAvailable: metrics.available,
    metricsError: metrics.error,
    totals: metrics.totals,
  };

  if (!rootDir) {
    return { projects: [], errors: [], rootDir: null, scannedAt, ...metricsMeta };
  }

  const errors: { path: string; message: string }[] = [];
  let manifestPaths: string[] = [];
  try {
    manifestPaths = await findManifests(rootDir);
  } catch (err) {
    errors.push({ path: rootDir, message: err instanceof Error ? err.message : String(err) });
    return { projects: [], errors, rootDir, scannedAt, ...metricsMeta };
  }

  const projects: ProjectSummary[] = [];
  for (const manifestPath of manifestPaths) {
    try {
      const raw = await readFile(manifestPath, 'utf8');
      const manifest = parseManifest(raw);
      projects.push(summarize(manifestPath, manifest, metrics.byProject));
    } catch (err) {
      errors.push({
        path: manifestPath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  projects.sort((a, b) => {
    const aTime = a.lastUpdated || '';
    const bTime = b.lastUpdated || '';
    return bTime.localeCompare(aTime);
  });

  return { projects, errors, rootDir, scannedAt, ...metricsMeta };
}

export function rootDirIsConfigured(): boolean {
  const explicit = process.env['ROOT_DIR'];
  return Boolean(explicit && explicit.trim().length > 0);
}
