import { describe, expect, it } from 'vitest';
import { spawnRun, validateRunArgs } from './runner';

describe('validateRunArgs', () => {
  it('rejects when neither project nor all is provided', () => {
    expect(validateRunArgs({})).toMatch(/required/);
  });

  it('rejects when both project and all are provided', () => {
    expect(validateRunArgs({ project: 'good', all: true })).toMatch(/not both/);
  });

  it('rejects project names with shell-meaningful characters', () => {
    const bad = ['foo;ls', 'foo bar', 'foo$bar', 'foo`bar`', '../etc', 'foo&', 'foo|baz'];
    for (const project of bad) {
      expect(validateRunArgs({ project })).toMatch(/invalid characters/);
    }
  });

  it('accepts a clean project name', () => {
    expect(validateRunArgs({ project: 'aahp-hub' })).toBeNull();
    expect(validateRunArgs({ project: 'my_project.v2' })).toBeNull();
  });

  it('rejects unsupported backend values', () => {
    expect(validateRunArgs({ all: true, backend: 'rogue' })).toMatch(/invalid backend/);
    expect(validateRunArgs({ all: true, backend: 'claude;rm' })).toMatch(/invalid backend/);
  });

  it('accepts each documented backend', () => {
    for (const backend of ['auto', 'claude', 'gemini', 'codex', 'copilot', 'sdk']) {
      expect(validateRunArgs({ all: true, backend })).toBeNull();
    }
  });

  it('rejects timeout outside 1-240 minutes or non-integer', () => {
    for (const timeoutMinutes of [0, -5, 999, 1.5]) {
      expect(validateRunArgs({ all: true, timeoutMinutes })).toMatch(/timeout out of range/);
    }
  });

  it('accepts a sensible timeout', () => {
    expect(validateRunArgs({ all: true, timeoutMinutes: 30 })).toBeNull();
  });

  it('rejects model names with path traversal characters', () => {
    expect(validateRunArgs({ all: true, model: '../etc/passwd' })).toMatch(/invalid model/);
    expect(validateRunArgs({ all: true, model: 'foo bar' })).toMatch(/invalid model/);
  });

  it('accepts canonical model names', () => {
    for (const model of ['claude-opus-4-7', 'gemini-2.5-flash', 'codex-mini']) {
      expect(validateRunArgs({ all: true, model })).toBeNull();
    }
  });
});

describe('spawnRun', () => {
  it('returns ok=false when validation fails (without invoking the runner)', () => {
    const result = spawnRun({});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/required/);
  });

  it('builds a command with --yes and the validated project name when runner is present', () => {
    const result = spawnRun({ project: 'aahp-hub', dryRun: true });
    if (!result.ok) {
      // Runner not installed in this environment; skip the spawn assertion.
      expect(result.error).toBeTruthy();
      return;
    }
    expect(result.command[0]).toMatch(/aahp(\.cmd|\.bat|\.exe)?$/);
    expect(result.command).toContain('aahp-hub');
    expect(result.command).toContain('--yes');
    expect(result.command).toContain('--dry-run');
  });
});
