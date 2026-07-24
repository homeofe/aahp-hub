export interface GitHubProjectLinks {
  repository: string;
  issues: string;
  pulls: string;
  actions: string;
  security: string;
}

export function normalizeGitHubRepo(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let candidate = value.trim();
  if (!candidate) return null;

  candidate = candidate.replace(/^git@github\.com:/i, '');
  while (/^https?:\/\/github\.com\//i.test(candidate)) {
    candidate = candidate.replace(/^https?:\/\/github\.com\//i, '');
  }
  candidate = candidate.replace(/^github\.com\//i, '').replace(/\.git\/?$/i, '').replace(/\/+$/, '');

  const match = candidate.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function githubProjectLinks(repo: string | null): GitHubProjectLinks | null {
  const normalized = normalizeGitHubRepo(repo);
  if (!normalized) return null;
  const repository = `https://github.com/${normalized}`;
  return {
    repository,
    issues: `${repository}/issues`,
    pulls: `${repository}/pulls`,
    actions: `${repository}/actions`,
    security: `${repository}/security`,
  };
}