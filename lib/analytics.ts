import 'server-only';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { RunMetric } from './metrics';

export interface BackendBreakdown {
  backend: string;
  runs: number;
  successes: number;
  failures: number;
  aborted: number;
  successRate: number;
  avgDurationMs: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  cacheHitRate: number;
}

export interface ModelBreakdown {
  modelId: string;
  runs: number;
  successes: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  cacheHitRate: number;
}

export interface DailyBucket {
  date: string;
  runs: number;
  successes: number;
  failures: number;
  aborted: number;
  totalTokens: number;
}

export interface ProjectCost {
  repo: string;
  runs: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  successRate: number;
}

export interface RecentFailure {
  timestamp: string;
  repo: string;
  taskId: string;
  taskTitle: string;
  backend: string;
  modelId: string | null;
  durationMs: number;
  aborted: boolean;
}

export interface AnalyticsResult {
  byBackend: BackendBreakdown[];
  byModel: ModelBreakdown[];
  daily: DailyBucket[];
  topByCost: ProjectCost[];
  recentFailures: RecentFailure[];
  totals: {
    runs: number;
    successes: number;
    failures: number;
    aborted: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReadTokens: number;
    avgDurationMs: number;
  };
  available: boolean;
  error: string | null;
  metricsFile: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function metricsFilePath(): string {
  const explicit = process.env['METRICS_FILE'];
  if (explicit && explicit.trim().length > 0) return explicit;
  const home = process.env['HOME'] ?? homedir();
  return join(/* turbopackIgnore: true */ home, '.aahp', 'metrics.jsonl');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickNumber(raw: Record<string, unknown>, key: string): number {
  const v = raw[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function pickOptionalNumber(raw: Record<string, unknown>, key: string): number | undefined {
  const v = raw[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function parseLine(line: string): RunMetric | null {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  if (typeof raw['timestamp'] !== 'string' || typeof raw['repo'] !== 'string') return null;
  return {
    timestamp: raw['timestamp'],
    repo: raw['repo'],
    taskId: typeof raw['taskId'] === 'string' ? raw['taskId'] : '',
    taskTitle: typeof raw['taskTitle'] === 'string' ? raw['taskTitle'] : '',
    backend: typeof raw['backend'] === 'string' ? raw['backend'] : 'unknown',
    durationMs: pickNumber(raw, 'durationMs'),
    turns: pickNumber(raw, 'turns'),
    success: raw['success'] === true,
    committed: raw['committed'] === true,
    cpuAvg: pickOptionalNumber(raw, 'cpuAvg'),
    memPeakMB: pickOptionalNumber(raw, 'memPeakMB'),
    inputTokens: pickOptionalNumber(raw, 'inputTokens'),
    outputTokens: pickOptionalNumber(raw, 'outputTokens'),
    cacheReadTokens: pickOptionalNumber(raw, 'cacheReadTokens'),
    cacheCreationTokens: pickOptionalNumber(raw, 'cacheCreationTokens'),
    modelId: typeof raw['modelId'] === 'string' ? raw['modelId'] : undefined,
    aborted: raw['aborted'] === true,
  };
}

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

function emptyAnalytics(file: string, available: boolean, error: string | null): AnalyticsResult {
  return {
    byBackend: [],
    byModel: [],
    daily: [],
    topByCost: [],
    recentFailures: [],
    totals: {
      runs: 0,
      successes: 0,
      failures: 0,
      aborted: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      avgDurationMs: 0,
    },
    available,
    error,
    metricsFile: file,
  };
}

export async function loadAnalytics(): Promise<AnalyticsResult> {
  const file = metricsFilePath();
  let text: string;
  try {
    text = await readFile(/* turbopackIgnore: true */ file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return emptyAnalytics(file, false, null);
    return emptyAnalytics(file, false, err instanceof Error ? err.message : String(err));
  }

  const entries: RunMetric[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    const parsed = parseLine(line);
    if (parsed) entries.push(parsed);
  }

  // Per-backend breakdown
  const backendMap = new Map<string, BackendBreakdown>();
  for (const m of entries) {
    let b = backendMap.get(m.backend);
    if (!b) {
      b = {
        backend: m.backend,
        runs: 0,
        successes: 0,
        failures: 0,
        aborted: 0,
        successRate: 0,
        avgDurationMs: 0,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
      };
      backendMap.set(m.backend, b);
    }
    b.runs++;
    if (m.success) b.successes++;
    else b.failures++;
    if (m.aborted) b.aborted++;
    b.avgDurationMs += m.durationMs;
    b.totalInputTokens += m.inputTokens ?? 0;
    b.totalOutputTokens += m.outputTokens ?? 0;
    b.totalCacheReadTokens += m.cacheReadTokens ?? 0;
  }
  const byBackend = [...backendMap.values()].map((b) => ({
    ...b,
    avgDurationMs: b.runs > 0 ? Math.round(b.avgDurationMs / b.runs) : 0,
    successRate: rate(b.successes, b.runs),
    totalTokens: b.totalInputTokens + b.totalOutputTokens,
    cacheHitRate: rate(b.totalCacheReadTokens, b.totalCacheReadTokens + b.totalInputTokens),
  }));
  byBackend.sort((a, b) => b.runs - a.runs);

  // Per-model breakdown
  const modelMap = new Map<string, ModelBreakdown>();
  for (const m of entries) {
    if (!m.modelId) continue;
    let r = modelMap.get(m.modelId);
    if (!r) {
      r = {
        modelId: m.modelId,
        runs: 0,
        successes: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
      };
      modelMap.set(m.modelId, r);
    }
    r.runs++;
    if (m.success) r.successes++;
    r.totalInputTokens += m.inputTokens ?? 0;
    r.totalOutputTokens += m.outputTokens ?? 0;
    r.totalCacheReadTokens += m.cacheReadTokens ?? 0;
  }
  const byModel = [...modelMap.values()].map((r) => ({
    ...r,
    cacheHitRate: rate(r.totalCacheReadTokens, r.totalCacheReadTokens + r.totalInputTokens),
  }));
  byModel.sort((a, b) => b.totalInputTokens + b.totalOutputTokens - (a.totalInputTokens + a.totalOutputTokens));

  // Daily buckets (last 14 days)
  const now = Date.now();
  const dailyMap = new Map<string, DailyBucket>();
  for (let i = 13; i >= 0; i--) {
    const ts = now - i * DAY_MS;
    const date = new Date(ts).toISOString().slice(0, 10);
    dailyMap.set(date, {
      date,
      runs: 0,
      successes: 0,
      failures: 0,
      aborted: 0,
      totalTokens: 0,
    });
  }
  for (const m of entries) {
    const date = m.timestamp.slice(0, 10);
    const bucket = dailyMap.get(date);
    if (!bucket) continue;
    bucket.runs++;
    if (m.success) bucket.successes++;
    else bucket.failures++;
    if (m.aborted) bucket.aborted++;
    bucket.totalTokens += (m.inputTokens ?? 0) + (m.outputTokens ?? 0);
  }
  const daily = [...dailyMap.values()];

  // Top 10 projects by token cost
  const projectMap = new Map<string, ProjectCost>();
  for (const m of entries) {
    let p = projectMap.get(m.repo);
    if (!p) {
      p = {
        repo: m.repo,
        runs: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        successRate: 0,
      };
      projectMap.set(m.repo, p);
    }
    p.runs++;
    p.inputTokens += m.inputTokens ?? 0;
    p.outputTokens += m.outputTokens ?? 0;
    if (m.success) p.successRate++;
  }
  const topByCost = [...projectMap.values()].map((p) => ({
    ...p,
    totalTokens: p.inputTokens + p.outputTokens,
    successRate: rate(p.successRate, p.runs),
  }));
  topByCost.sort((a, b) => b.totalTokens - a.totalTokens);
  const topByCostSliced = topByCost.slice(0, 10);

  // Recent failures (last 20)
  const recentFailures: RecentFailure[] = entries
    .filter((m) => !m.success)
    .slice(-20)
    .reverse()
    .map((m) => ({
      timestamp: m.timestamp,
      repo: m.repo,
      taskId: m.taskId,
      taskTitle: m.taskTitle,
      backend: m.backend,
      modelId: m.modelId ?? null,
      durationMs: m.durationMs,
      aborted: m.aborted ?? false,
    }));

  // Totals
  const totalSuccesses = entries.filter((m) => m.success).length;
  const totalFailures = entries.length - totalSuccesses;
  const totalAborted = entries.filter((m) => m.aborted).length;
  const totalInput = entries.reduce((s, m) => s + (m.inputTokens ?? 0), 0);
  const totalOutput = entries.reduce((s, m) => s + (m.outputTokens ?? 0), 0);
  const totalCacheRead = entries.reduce((s, m) => s + (m.cacheReadTokens ?? 0), 0);
  const totalDuration = entries.reduce((s, m) => s + m.durationMs, 0);

  return {
    byBackend,
    byModel,
    daily,
    topByCost: topByCostSliced,
    recentFailures,
    totals: {
      runs: entries.length,
      successes: totalSuccesses,
      failures: totalFailures,
      aborted: totalAborted,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCacheReadTokens: totalCacheRead,
      avgDurationMs: entries.length > 0 ? Math.round(totalDuration / entries.length) : 0,
    },
    available: true,
    error: null,
    metricsFile: file,
  };
}
