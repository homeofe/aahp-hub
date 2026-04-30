import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSessions, sessionsFilePath } from './sessions';

let tmpRoot: string;
let sessionsFile: string;
const originalSessions = process.env['SESSIONS_FILE'];
const originalHome = process.env['HOME'];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'aahp-hub-sessions-'));
  sessionsFile = join(tmpRoot, 'sessions.json');
  process.env['SESSIONS_FILE'] = sessionsFile;
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  if (originalSessions === undefined) delete process.env['SESSIONS_FILE'];
  else process.env['SESSIONS_FILE'] = originalSessions;
  if (originalHome === undefined) delete process.env['HOME'];
  else process.env['HOME'] = originalHome;
});

describe('sessionsFilePath', () => {
  it('honours SESSIONS_FILE when set', () => {
    expect(sessionsFilePath()).toBe(sessionsFile);
  });

  it('falls back to HOME/.aahp/sessions.json when SESSIONS_FILE is unset', () => {
    delete process.env['SESSIONS_FILE'];
    process.env['HOME'] = tmpRoot;
    expect(sessionsFilePath()).toBe(join(tmpRoot, '.aahp', 'sessions.json'));
  });
});

describe('loadSessions', () => {
  it('returns available=false when the file does not exist', async () => {
    const result = await loadSessions();
    expect(result.available).toBe(false);
    expect(result.error).toBeNull();
    expect(result.sessions).toHaveLength(0);
  });

  it('parses a valid sessions file', async () => {
    writeFileSync(
      sessionsFile,
      JSON.stringify({
        updatedAt: '2026-04-30T10:00:00Z',
        sessions: [
          {
            repoPath: join(tmpRoot, 'r1'),
            repoName: 'r1',
            taskId: 'T-001',
            taskTitle: 'work',
            backend: 'claude-cli',
            startedAt: '2026-04-30T09:00:00Z',
          },
        ],
      }),
      'utf8',
    );

    const result = await loadSessions();
    expect(result.available).toBe(true);
    expect(result.error).toBeNull();
    expect(result.updatedAt).toBe('2026-04-30T10:00:00Z');
    expect(result.sessions).toHaveLength(1);
    const s = result.sessions[0]!;
    expect(s.repoName).toBe('r1');
    expect(s.taskId).toBe('T-001');
    expect(s.lastLine).toBe('');
  });

  it('returns error metadata for malformed JSON', async () => {
    writeFileSync(sessionsFile, '{ broken', 'utf8');
    const result = await loadSessions();
    expect(result.error).not.toBeNull();
    expect(result.sessions).toHaveLength(0);
  });

  it('skips session entries missing required fields', async () => {
    writeFileSync(
      sessionsFile,
      JSON.stringify({
        sessions: [
          { repoPath: '/x', repoName: 'good', taskId: 'T-001' },
          { repoPath: '/y' },
          { taskId: 'T-002' },
          'a string',
          null,
        ],
      }),
      'utf8',
    );

    const result = await loadSessions();
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]!.repoName).toBe('good');
  });

  it('reads the last log line from the per-repo log file', async () => {
    const repoDir = join(tmpRoot, 'logged-repo');
    const logsDir = join(repoDir, '.ai', 'logs');
    mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    writeFileSync(
      join(logsDir, `${stamp}.log`),
      ['= header banner', 'first line', 'second line   with spaces', ''].join('\n'),
      'utf8',
    );

    writeFileSync(
      sessionsFile,
      JSON.stringify({
        sessions: [
          {
            repoPath: repoDir,
            repoName: 'logged-repo',
            taskId: 'T-001',
            taskTitle: 'work',
            backend: 'claude-cli',
            startedAt: '2026-04-30T09:00:00Z',
          },
        ],
      }),
      'utf8',
    );

    const result = await loadSessions();
    expect(result.sessions[0]!.lastLine).toBe('second line with spaces');
  });

  it('returns empty for non-object root', async () => {
    writeFileSync(sessionsFile, '"hello"', 'utf8');
    const result = await loadSessions();
    expect(result.error).not.toBeNull();
    expect(result.sessions).toHaveLength(0);
  });
});
