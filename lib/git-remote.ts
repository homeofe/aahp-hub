/**
 * Maps a local checkout to the forge it actually pushes to.
 *
 * The directory name is NOT a reliable repository name: several workspace
 * directories differ from the repository they track, and some projects were
 * migrated to a self-hosted Forgejo and no longer exist on GitHub at all.
 * The origin remote is the only honest source, so every mapping starts there.
 *
 * The parsing helpers in this module are pure so they can be unit tested
 * without a filesystem or a git binary.
 */

/** Repository owner segment, as GitHub itself validates it. */
export const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** Repository name segment. Deliberately strict: this string is embedded in a
 *  GraphQL document, so anything outside this set is rejected rather than
 *  escaped. */
export const GITHUB_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com', 'ssh.github.com']);

export type RemoteKind =
  /** origin points at github.com and owner/name are usable */
  | 'github'
  /** origin points at some other forge (self-hosted Forgejo, GitLab, ...) */
  | 'other-host'
  /** there is an origin URL but it could not be mapped to owner/name */
  | 'unmappable'
  /** no git checkout, or a checkout with no remotes */
  | 'none';

export interface ProjectRemote {
  kind: RemoteKind;
  /** `owner/name`, only ever set when kind === 'github' */
  repo: string | null;
  /** hostname without port or credentials, null when unknown */
  host: string | null;
  /** origin URL with any embedded credentials stripped, for display */
  url: string | null;
  /** which remote the URL came from ('origin' unless origin is absent) */
  remoteName: string | null;
  /** how the mapping was derived */
  source: 'git-remote' | 'manifest' | 'none';
}

export interface ParsedRemoteUrl {
  host: string;
  owner: string;
  name: string;
}

export const UNKNOWN_REMOTE: ProjectRemote = {
  kind: 'none',
  repo: null,
  host: null,
  url: null,
  remoteName: null,
  source: 'none',
};

function stripCredentials(authority: string): string {
  const at = authority.lastIndexOf('@');
  return at >= 0 ? authority.slice(at + 1) : authority;
}

function hostFromAuthority(authority: string): string {
  return stripCredentials(authority).replace(/:\d+$/, '').toLowerCase();
}

function splitOwnerName(path: string): { owner: string; name: string } | null {
  const cleaned = path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const parts = cleaned.split('/').filter((part) => part.length > 0);
  if (parts.length !== 2) return null;
  const [owner, name] = parts as [string, string];
  if (owner.length === 0 || name.length === 0) return null;
  return { owner, name };
}

/**
 * Parse any of the URL shapes git accepts into host + owner + name.
 * Returns null for local paths, file:// URLs and anything that does not
 * resolve to exactly two path segments.
 */
export function parseRemoteUrl(raw: unknown): ParsedRemoteUrl | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value.length === 0) return null;

  const scheme = value.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\/(.*)$/);
  if (scheme) {
    const protocol = (scheme[1] ?? '').toLowerCase();
    if (protocol === 'file') return null;
    const rest = scheme[2] ?? '';
    const slash = rest.indexOf('/');
    if (slash < 0) return null;
    const host = hostFromAuthority(rest.slice(0, slash));
    const parts = splitOwnerName(rest.slice(slash));
    if (host.length === 0 || !parts) return null;
    return { host, owner: parts.owner, name: parts.name };
  }

  // scp-like syntax: [user@]host:owner/name. The negative lookahead keeps
  // Windows drive paths (C:\src\repo, C:/src/repo) out of this branch.
  const scp = value.match(/^(?:([^@\s/\\]+)@)?([A-Za-z0-9._-]+)(?::(\d+))?:(?![\\/])(.+)$/);
  if (scp) {
    const user = scp[1];
    const host = (scp[2] ?? '').toLowerCase();
    const parts = splitOwnerName(scp[4] ?? '');
    const plausibleHost = Boolean(user) || host.includes('.');
    if (host.length > 0 && plausibleHost && parts) {
      return { host, owner: parts.owner, name: parts.name };
    }
  }

  return null;
}

/** Remove `user:token@` from a URL before it is ever rendered or logged. */
export function redactRemoteUrl(raw: string): string {
  return raw.replace(/^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^@/]*@/, '$1');
}

export function isGitHubHost(host: string): boolean {
  return GITHUB_HOSTS.has(host.toLowerCase());
}

export function isValidRepoRef(owner: string, name: string): boolean {
  if (!GITHUB_OWNER_PATTERN.test(owner)) return false;
  if (!GITHUB_NAME_PATTERN.test(name)) return false;
  return name !== '.' && name !== '..';
}

/**
 * Turn an origin URL into the mapping the dashboard renders.
 * A project without a GitHub origin is "not applicable", never an error.
 */
export function classifyRemoteUrl(
  url: string | null,
  remoteName: string | null = 'origin',
): ProjectRemote {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return UNKNOWN_REMOTE;
  }
  const display = redactRemoteUrl(url.trim());
  const parsed = parseRemoteUrl(url);
  if (!parsed) {
    return {
      kind: 'unmappable',
      repo: null,
      host: null,
      url: display,
      remoteName,
      source: 'git-remote',
    };
  }
  if (!isGitHubHost(parsed.host)) {
    return {
      kind: 'other-host',
      repo: null,
      host: parsed.host,
      url: display,
      remoteName,
      source: 'git-remote',
    };
  }
  if (!isValidRepoRef(parsed.owner, parsed.name)) {
    return {
      kind: 'unmappable',
      repo: null,
      host: parsed.host,
      url: display,
      remoteName,
      source: 'git-remote',
    };
  }
  return {
    kind: 'github',
    repo: `${parsed.owner}/${parsed.name}`,
    host: parsed.host,
    url: display,
    remoteName,
    source: 'git-remote',
  };
}

/**
 * Fallback used only when a checkout has no remote at all: the handoff
 * MANIFEST may still declare `github_repo`. The result is tagged
 * `source: 'manifest'` so the UI can say where the mapping came from.
 */
export function classifyManifestRepo(declared: unknown): ProjectRemote {
  if (typeof declared !== 'string') return UNKNOWN_REMOTE;
  const normalized = declared.trim().replace(/\.git$/i, '');
  const parts = normalized.split('/').filter((part) => part.length > 0);
  if (parts.length !== 2) return UNKNOWN_REMOTE;
  const [owner, name] = parts as [string, string];
  if (!isValidRepoRef(owner, name)) return UNKNOWN_REMOTE;
  return {
    kind: 'github',
    repo: `${owner}/${name}`,
    host: 'github.com',
    url: `https://github.com/${owner}/${name}`,
    remoteName: null,
    source: 'manifest',
  };
}

/**
 * Parse the `[remote "<name>"] url = ...` pairs out of a git config file.
 * Section headers, indentation and comment styles follow git's own config
 * syntax closely enough for the remote lookup we need.
 */
export function parseGitConfigRemotes(text: string): Map<string, string> {
  const remotes = new Map<string, string>();
  let current: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith(';')) continue;

    const section = line.match(/^\[([^\]]*)\]/);
    if (section) {
      const header = (section[1] ?? '').trim();
      const named = header.match(/^remote\s+"(.*)"$/i);
      current = named ? (named[1] ?? null) : null;
      continue;
    }

    if (current === null) continue;
    const pair = line.match(/^url\s*=\s*(.*)$/i);
    if (!pair) continue;
    const value = (pair[1] ?? '').trim().replace(/^"(.*)"$/, '$1');
    if (value.length > 0 && !remotes.has(current)) {
      remotes.set(current, value);
    }
  }

  return remotes;
}

/**
 * Pick the remote a project should be judged by: origin, then upstream,
 * then the first remote in file order.
 */
export function pickRemote(
  remotes: Map<string, string>,
): { name: string; url: string } | null {
  for (const preferred of ['origin', 'upstream']) {
    const url = remotes.get(preferred);
    if (url) return { name: preferred, url };
  }
  const first = [...remotes.entries()][0];
  return first ? { name: first[0], url: first[1] } : null;
}
