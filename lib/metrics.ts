import 'server-only';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface RunMetric {
  timestamp: string;
  repo: string;
  taskId: string;
  taskTitle: string;
  backend: string;
  durationMs: number;
  turns: number;
  success: boolean;
  committed: boolean;
  cpuAvg?: number;
  memPeakMB?: number;
}

export interface ProjectMetrics {
  totalRuns: number;
  runs24h: number;
  runs7d: number;
  successRate: number;
  avgDurationMs: number;
  avgTurns: number;
  lastRunAt: string | null;
  lastRunSuccess: boolean | null;
  lastRunBackend: string | null;
}

export interface MetricsResult {
  byProject: Map<string, ProjectMetrics>;
  totals: {
    totalRuns: number;
    runs24h: number;
    runs7d: number;
    successRate: number;
  };
  metricsFile: string;
  available: boolean;
  error: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function metricsFilePath(): string {
  const explicit = process.env['METRICS_FILE'];
  if (explicit && explicit.trim().length > 0) {
    return explicit;
  }
  const home = process.env['HOME'] ?? homedir();
  return join(home, '.aahp', 'metrics.jsonl');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseLine(line: string): RunMetric | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const t = raw['timestamp'];
  const r = raw['repo'];
  if (typeof t !== 'string' || typeof r !== 'string') return null;
  return {
    timestamp: t,
    repo: r,
    taskId: typeof raw['taskId'] === 'string' ? raw['taskId'] : '',
    taskTitle: typeof raw['taskTitle'] === 'string' ? raw['taskTitle'] : '',
    backend: typeof raw['backend'] === 'string' ? raw['backend'] : 'unknown',
    durationMs: typeof raw['durationMs'] === 'number' ? raw['durationMs'] : 0,
    turns: typeof raw['turns'] === 'number' ? raw['turns'] : 0,
    success: raw['success'] === true,
    committed: raw['committed'] === true,
    cpuAvg: typeof raw['cpuAvg'] === 'number' ? raw['cpuAvg'] : undefined,
    memPeakMB: typeof raw['memPeakMB'] === 'number' ? raw['memPeakMB'] : undefined,
  };
}

function summarize(entries: RunMetric[], now: number): ProjectMetrics {
  const cutoff24h = now - DAY_MS;
  const cutoff7d = now - 7 * DAY_MS;

  let runs24h = 0;
  let runs7d = 0;
  let successCount = 0;
  let totalDuration = 0;
  let totalTurns = 0;
  let lastTs = -Infinity;
  let lastEntry: RunMetric | null = null;

  for (const m of entries) {
    const ts = Date.parse(m.timestamp);
    if (Number.isNaN(ts)) continue;
    if (ts >= cutoff24h) runs24h++;
    if (ts >= cutoff7d) runs7d++;
    if (m.success) successCount++;
    totalDuration += m.durationMs;
    totalTurns += m.turns;
    if (ts > lastTs) {
      lastTs = ts;
      lastEntry = m;
    }
  }

  const total = entries.length;
  return {
    totalRuns: total,
    runs24h,
    runs7d,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    avgDurationMs: total > 0 ? Math.round(totalDuration / total) : 0,
    avgTurns: total > 0 ? Math.round((totalTurns / total) * 10) / 10 : 0,
    lastRunAt: lastEntry ? lastEntry.timestamp : null,
    lastRunSuccess: lastEntry ? lastEntry.success : null,
    lastRunBackend: lastEntry ? lastEntry.backend : null,
  };
}

export async function loadMetrics(): Promise<MetricsResult> {
  const file = metricsFilePath();
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {
        byProject: new Map(),
        totals: { totalRuns: 0, runs24h: 0, runs7d: 0, successRate: 0 },
        metricsFile: file,
        available: false,
        error: null,
      };
    }
    return {
      byProject: new Map(),
      totals: { totalRuns: 0, runs24h: 0, runs7d: 0, successRate: 0 },
      metricsFile: file,
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const entries: RunMetric[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    const parsed = parseLine(line);
    if (parsed) entries.push(parsed);
  }

  const grouped = new Map<string, RunMetric[]>();
  for (const m of entries) {
    const bucket = grouped.get(m.repo);
    if (bucket) {
      bucket.push(m);
    } else {
      grouped.set(m.repo, [m]);
    }
  }

  const now = Date.now();
  const byProject = new Map<string, ProjectMetrics>();
  for (const [repo, list] of grouped) {
    byProject.set(repo, summarize(list, now));
  }

  const totals = summarize(entries, now);
  return {
    byProject,
    totals: {
      totalRuns: totals.totalRuns,
      runs24h: totals.runs24h,
      runs7d: totals.runs7d,
      successRate: totals.successRate,
    },
    metricsFile: file,
    available: true,
    error: null,
  };
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '-';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) return remSec > 0 ? `${minutes}m ${remSec}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}
