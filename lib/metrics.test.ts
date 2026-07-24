import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatDuration, formatTokens, loadMetrics } from './metrics';

let tmpRoot: string;
let metricsFile: string;
const originalMetrics = process.env['METRICS_FILE'];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aahp-hub-metrics-'));
  metricsFile = join(tmpRoot, 'metrics.jsonl');
  process.env['METRICS_FILE'] = metricsFile;
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  if (originalMetrics === undefined) delete process.env['METRICS_FILE'];
  else process.env['METRICS_FILE'] = originalMetrics;
});

function metric(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    repo: 'r',
    taskId: 'T-001',
    taskTitle: 't',
    backend: 'claude-cli',
    durationMs: 1000,
    turns: 1,
    success: true,
    committed: true,
    ...overrides,
  });
}

describe('loadMetrics', () => {
  it('returns available=false when the file does not exist', async () => {
    const result = await loadMetrics();
    expect(result.available).toBe(false);
    expect(result.error).toBeNull();
    expect(result.byProject.size).toBe(0);
    expect(result.totals.totalRuns).toBe(0);
  });

  it('parses a valid JSONL file and groups by repo', async () => {
    writeFileSync(
      metricsFile,
      [
        metric({ repo: 'a', durationMs: 1000, success: true }),
        metric({ repo: 'a', durationMs: 3000, success: false }),
        metric({ repo: 'b', durationMs: 2000, success: true }),
      ].join('\n'),
      'utf8',
    );

    const result = await loadMetrics();
    expect(result.available).toBe(true);
    expect(result.byProject.size).toBe(2);
    const a = result.byProject.get('a')!;
    expect(a.totalRuns).toBe(2);
    expect(a.successRate).toBe(50);
    expect(a.avgDurationMs).toBe(2000);
    const b = result.byProject.get('b')!;
    expect(b.totalRuns).toBe(1);
    expect(b.successRate).toBe(100);
    expect(result.totals.totalRuns).toBe(3);
  });

  it('skips malformed lines and blank lines', async () => {
    writeFileSync(
      metricsFile,
      [
        '',
        'not json',
        '{"foo":1}',
        metric({ repo: 'a' }),
        '   ',
        metric({ repo: 'a' }),
      ].join('\n'),
      'utf8',
    );

    const result = await loadMetrics();
    expect(result.byProject.get('a')!.totalRuns).toBe(2);
  });

  it('windows runs by 24h and 7d', async () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    writeFileSync(
      metricsFile,
      [
        metric({ repo: 'a', timestamp: oneHourAgo }),
        metric({ repo: 'a', timestamp: threeDaysAgo }),
        metric({ repo: 'a', timestamp: twoWeeksAgo }),
      ].join('\n'),
      'utf8',
    );

    const result = await loadMetrics();
    const a = result.byProject.get('a')!;
    expect(a.runs24h).toBe(1);
    expect(a.runs7d).toBe(2);
    expect(a.totalRuns).toBe(3);
  });

  it('reports the last run', async () => {
    const earlier = '2026-04-01T00:00:00Z';
    const later = '2026-04-30T00:00:00Z';
    writeFileSync(
      metricsFile,
      [
        metric({ repo: 'a', timestamp: earlier, success: false, backend: 'sdk' }),
        metric({ repo: 'a', timestamp: later, success: true, backend: 'claude-cli' }),
      ].join('\n'),
      'utf8',
    );

    const result = await loadMetrics();
    const a = result.byProject.get('a')!;
    expect(a.lastRunAt).toBe(later);
    expect(a.lastRunSuccess).toBe(true);
    expect(a.lastRunBackend).toBe('claude-cli');
  });

  it('builds a seven-day run series and orders recent events by timestamp', async () => {
    const now = Date.now();
    const today = new Date(now - 60 * 60 * 1000).toISOString();
    const yesterday = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

    writeFileSync(
      metricsFile,
      [
        metric({ repo: 'a', timestamp: yesterday, taskId: 'T-002' }),
        metric({ repo: 'a', timestamp: today, taskId: 'T-003' }),
        metric({ repo: 'a', timestamp: threeDaysAgo, taskId: 'T-001' }),
      ].join('\n'),
      'utf8',
    );

    const a = (await loadMetrics()).byProject.get('a')!;
    expect(a.dailyRuns).toHaveLength(7);
    expect(a.dailyRuns.reduce((sum, count) => sum + count, 0)).toBe(3);
    expect(a.recentEvents.map((event) => event.taskId)).toEqual([
      'T-003',
      'T-002',
      'T-001',
    ]);
  });
});

describe('token aggregation', () => {
  it('sums tokens across runs and computes cache hit rate', async () => {
    writeFileSync(
      metricsFile,
      [
        metric({
          repo: 'a',
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 400,
          cacheCreationTokens: 20,
        }),
        metric({
          repo: 'a',
          inputTokens: 200,
          outputTokens: 60,
          cacheReadTokens: 100,
        }),
        metric({ repo: 'a' }),
      ].join('\n'),
      'utf8',
    );

    const result = await loadMetrics();
    const tokens = result.byProject.get('a')!.tokens;
    expect(tokens.inputTokens).toBe(300);
    expect(tokens.outputTokens).toBe(110);
    expect(tokens.cacheReadTokens).toBe(500);
    expect(tokens.cacheCreationTokens).toBe(20);
    expect(tokens.recordedRuns).toBe(2);
    expect(tokens.cacheHitRate).toBe(63);
  });

  it('reports zero cacheHitRate when there are no token records', async () => {
    writeFileSync(metricsFile, [metric({ repo: 'a' })].join('\n'), 'utf8');
    const result = await loadMetrics();
    expect(result.byProject.get('a')!.tokens.recordedRuns).toBe(0);
    expect(result.byProject.get('a')!.tokens.cacheHitRate).toBe(0);
  });

  it('windows token totals to the last 24h', async () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
    writeFileSync(
      metricsFile,
      [
        metric({ repo: 'a', timestamp: oneHourAgo, inputTokens: 100, outputTokens: 50 }),
        metric({ repo: 'a', timestamp: eightDaysAgo, inputTokens: 9000, outputTokens: 5000 }),
      ].join('\n'),
      'utf8',
    );

    const a = (await loadMetrics()).byProject.get('a')!;
    expect(a.tokens.inputTokens).toBe(9100);
    expect(a.tokens24h.inputTokens).toBe(100);
    expect(a.tokens24h.outputTokens).toBe(50);
  });

  it('counts aborted runs separately', async () => {
    writeFileSync(
      metricsFile,
      [
        metric({ repo: 'a', success: false, aborted: true }),
        metric({ repo: 'a', success: true }),
        metric({ repo: 'a', success: false }),
      ].join('\n'),
      'utf8',
    );
    const a = (await loadMetrics()).byProject.get('a')!;
    expect(a.abortedRuns).toBe(1);
    expect(a.totalRuns).toBe(3);
  });
});

describe('formatTokens', () => {
  it('formats raw counts under 1000', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(42)).toBe('42');
    expect(formatTokens(999)).toBe('999');
  });

  it('formats thousands with one decimal under 10k, none above', () => {
    expect(formatTokens(1500)).toBe('1.5k');
    expect(formatTokens(15000)).toBe('15k');
    expect(formatTokens(999_999)).toBe('1000k');
  });

  it('formats millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.5M');
    expect(formatTokens(20_000_000)).toBe('20M');
  });
});

describe('formatDuration', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatDuration(500)).toBe('1s');
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('formats sub-hour durations in minutes', () => {
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(125_000)).toBe('2m 5s');
  });

  it('formats hour-plus durations', () => {
    expect(formatDuration(60 * 60 * 1000)).toBe('1h');
    expect(formatDuration(90 * 60 * 1000)).toBe('1h 30m');
  });

  it('returns - for non-positive durations', () => {
    expect(formatDuration(0)).toBe('-');
    expect(formatDuration(-100)).toBe('-');
  });
});
