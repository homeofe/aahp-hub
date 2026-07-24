import 'server-only';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
export { formatTokens, formatDuration } from './format';

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
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  modelId?: string;
  aborted?: boolean;
}

export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cacheHitRate: number;
  recordedRuns: number;
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
  abortedRuns: number;
  tokens: TokenStats;
  tokens24h: TokenStats;
  dailyRuns: number[];
  recentEvents: RecentEvent[];
}

export interface RecentEvent {
  timestamp: string;
  repo: string;
  taskId: string;
  taskTitle: string;
  success: boolean;
  aborted: boolean;
  backend: string;
}

export interface MetricsResult {
  byProject: Map<string, ProjectMetrics>;
  totals: {
    totalRuns: number;
    runs24h: number;
    runs7d: number;
    successRate: number;
    abortedRuns: number;
    tokens: TokenStats;
    tokens24h: TokenStats;
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
  return join(/* turbopackIgnore: true */ home, '.aahp', 'metrics.jsonl');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickNumber(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
    cpuAvg: pickNumber(raw, 'cpuAvg'),
    memPeakMB: pickNumber(raw, 'memPeakMB'),
    inputTokens: pickNumber(raw, 'inputTokens'),
    outputTokens: pickNumber(raw, 'outputTokens'),
    cacheReadTokens: pickNumber(raw, 'cacheReadTokens'),
    cacheCreationTokens: pickNumber(raw, 'cacheCreationTokens'),
    modelId: typeof raw['modelId'] === 'string' ? raw['modelId'] : undefined,
    aborted: raw['aborted'] === true,
  };
}

function emptyTokenStats(): TokenStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    cacheHitRate: 0,
    recordedRuns: 0,
  };
}

function accumulateTokens(stats: TokenStats, m: RunMetric): void {
  if (
    m.inputTokens === undefined &&
    m.outputTokens === undefined &&
    m.cacheReadTokens === undefined &&
    m.cacheCreationTokens === undefined
  ) {
    return;
  }
  stats.inputTokens += m.inputTokens ?? 0;
  stats.outputTokens += m.outputTokens ?? 0;
  stats.cacheReadTokens += m.cacheReadTokens ?? 0;
  stats.cacheCreationTokens += m.cacheCreationTokens ?? 0;
  stats.recordedRuns += 1;
}

function finaliseTokens(stats: TokenStats): void {
  const cachePool = stats.cacheReadTokens + stats.inputTokens;
  stats.cacheHitRate =
    cachePool > 0 ? Math.round((stats.cacheReadTokens / cachePool) * 100) : 0;
}

function emptyTotals(): MetricsResult['totals'] {
  return {
    totalRuns: 0,
    runs24h: 0,
    runs7d: 0,
    successRate: 0,
    abortedRuns: 0,
    tokens: emptyTokenStats(),
    tokens24h: emptyTokenStats(),
  };
}

function summarize(entries: RunMetric[], now: number): ProjectMetrics {
  const cutoff24h = now - DAY_MS;
  const cutoff7d = now - 7 * DAY_MS;

  let runs24h = 0;
  let runs7d = 0;
  let successCount = 0;
  let abortedRuns = 0;
  let totalDuration = 0;
  let totalTurns = 0;
  let lastTs = -Infinity;
  let lastEntry: RunMetric | null = null;
  const tokens = emptyTokenStats();
  const tokens24h = emptyTokenStats();

  // Daily run counts for sparkline (last 7 days)
  const dailyMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    dailyMap.set(date, 0);
  }

  for (const m of entries) {
    const ts = Date.parse(m.timestamp);
    if (Number.isNaN(ts)) continue;
    if (ts >= cutoff24h) runs24h++;
    if (ts >= cutoff7d) runs7d++;
    if (m.success) successCount++;
    if (m.aborted) abortedRuns++;
    totalDuration += m.durationMs;
    totalTurns += m.turns;
    accumulateTokens(tokens, m);
    if (ts >= cutoff24h) accumulateTokens(tokens24h, m);
    if (ts > lastTs) {
      lastTs = ts;
      lastEntry = m;
    }
    // Accumulate daily counts
    const day = m.timestamp.slice(0, 10);
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    }
  }

  finaliseTokens(tokens);
  finaliseTokens(tokens24h);

  const dailyRuns = [...dailyMap.values()];

  // Recent events (last 10)
  const recentEvents: RecentEvent[] = [...entries]
    .filter((m) => !Number.isNaN(Date.parse(m.timestamp)))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 10)
    .map((m) => ({
      timestamp: m.timestamp,
      repo: m.repo,
      taskId: m.taskId,
      taskTitle: m.taskTitle,
      success: m.success,
      aborted: m.aborted ?? false,
      backend: m.backend,
    }));

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
    abortedRuns,
    tokens,
    tokens24h,
    dailyRuns,
    recentEvents,
  };
}

export async function loadMetrics(): Promise<MetricsResult> {
  const file = metricsFilePath();
  let text: string;
  try {
    text = await readFile(/* turbopackIgnore: true */ file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {
        byProject: new Map(),
        totals: emptyTotals(),
        metricsFile: file,
        available: false,
        error: null,
      };
    }
    return {
      byProject: new Map(),
      totals: emptyTotals(),
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
      abortedRuns: totals.abortedRuns,
      tokens: totals.tokens,
      tokens24h: totals.tokens24h,
    },
    metricsFile: file,
    available: true,
    error: null,
  };
}
