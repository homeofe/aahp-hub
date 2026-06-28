import { describe, it, expect } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { redactHome } from './redact.js';

describe('redactHome', () => {
  it('replaces the home prefix with ~', () => {
    const p = join(homedir(), '.aahp', 'sessions.json');
    const out = redactHome(p);
    expect(out.startsWith('~')).toBe(true);
    expect(out).not.toContain(homedir());
  });

  it('returns ~ for the home directory itself', () => {
    expect(redactHome(homedir())).toBe('~');
  });

  it('redacts a forward-slash home path (Windows separator tolerance)', () => {
    const p = homedir().replace(/\\/g, '/') + '/.aahp/sessions.json';
    const out = redactHome(p);
    expect(out.startsWith('~')).toBe(true);
    expect(out.toLowerCase()).not.toContain(homedir().toLowerCase());
  });

  it('leaves non-home paths unchanged', () => {
    const p = process.platform === 'win32' ? 'C:\\opt\\data\\x.json' : '/opt/data/x.json';
    expect(redactHome(p)).toBe(p);
  });

  it('passes through empty / non-string input', () => {
    expect(redactHome('')).toBe('');
    // @ts-expect-error exercising the defensive guard
    expect(redactHome(null)).toBe(null);
  });
});
