import { describe, expect, it } from 'vitest';
import { githubProjectLinks, normalizeGitHubRepo } from './project-links';

describe('normalizeGitHubRepo', () => {
  it.each([
    ['homeofe/aahp-hub', 'homeofe/aahp-hub'],
    ['https://github.com/homeofe/aahp-hub', 'homeofe/aahp-hub'],
    ['https://github.com/https://github.com/homeofe/aahp-hub.git', 'homeofe/aahp-hub'],
    ['git@github.com:homeofe/aahp-hub.git', 'homeofe/aahp-hub'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeGitHubRepo(input)).toBe(expected);
  });

  it.each(['', 'github.com', 'https://example.com/home/repo', 'owner/repo/extra'])('rejects %s', (input) => {
    expect(normalizeGitHubRepo(input)).toBeNull();
  });
});

describe('githubProjectLinks', () => {
  it('builds every project action from the normalized repository', () => {
    expect(githubProjectLinks('https://github.com/homeofe/aahp-hub')).toEqual({
      repository: 'https://github.com/homeofe/aahp-hub',
      issues: 'https://github.com/homeofe/aahp-hub/issues',
      pulls: 'https://github.com/homeofe/aahp-hub/pulls',
      actions: 'https://github.com/homeofe/aahp-hub/actions',
      security: 'https://github.com/homeofe/aahp-hub/security',
    });
  });
});