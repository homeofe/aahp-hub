import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatDuration, loadMetrics } from './metrics';

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
