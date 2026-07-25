import 'server-only';
import { runCommand, type CommandResult } from './exec';
import { isValidRepoRef } from './git-remote';

/**
 * GitHub data layer.
 *
 * Credentials: none are handled here. The hub shells out to the `gh` CLI,
 * which supplies its own already-configured credentials from the OS keyring.
 * There is deliberately no token environment variable, no token file and no
 * token in memory anywhere in this process.
 *
 * Cost: one aliased GraphQL document covers a whole chunk of repositories for
 * a single rate-limit point, so the entire fleet is one or two calls.
 */

export interface RepoRef {
  owner: string;
  name: string;
}

export interface RepoStats {
  nameWithOwner: string;
  url: string;
  isArchived: boolean;
  isPrivate: boolean;
  isFork: boolean;
  pushedAt: string | null;
  defaultBranch: string | null;
  defaultBranchOid: string | null;
  openIssues: number;
  closedIssues: number;
  openPullRequests: number;
  /** PRs merged. GitHub's CLOSED state EXCLUDES these. */
  mergedPullRequests: number;
  /** PRs closed WITHOUT being merged. A rejection signal, not a delivery one. */
  closedPullRequests: number;
  /**
   * Open Dependabot alerts, or null when the token cannot read them for this
   * repository. null means "unknown", which is rendered differently from 0.
   */
  securityAlerts: number | null;
  /** Notes about fields that came back partially, e.g. unreadable alerts. */
  partial: string[];
}

export interface RateLimitInfo {
  cost: number;
  remaining: number;
  limit: number;
  resetAt: string | null;
}

export type GhFailureKind =
  | 'not-installed'
  | 'not-authenticated'
  | 'rate-limited'
  | 'network'
  | 'timeout'
  | 'unknown';

export interface GhFailure {
  kind: GhFailureKind;
  message: string;
}

export interface RepoStatsResult {
  /** Keyed by lowercase `owner/name`. */
  stats: Map<string, RepoStats>;
  /** Repositories that failed individually (deleted, renamed, no access). */
  repoErrors: Map<string, string>;
  /** Failures that affected a whole request rather than one repository. */
  failures: GhFailure[];
  rateLimit: RateLimitInfo | null;
}

/** Repos per GraphQL document. One point of rate limit either way; chunking
 *  just bounds the blast radius of a single failed request. */
export const DEFAULT_CHUNK_SIZE = 30;

const GH_TIMEOUT_MS = 45_000;

export function repoKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.name}`.toLowerCase();
}

export function parseRepoRef(full: string): RepoRef | null {
  const parts = full.split('/');
  if (parts.length !== 2) return null;
  const [owner, name] = parts as [string, string];
  if (!isValidRepoRef(owner, name)) return null;
  return { owner, name };
}

const REPO_FRAGMENT = `fragment HubRepoStats on Repository {
  nameWithOwner
  url
  isArchived
  isPrivate
  isFork
  pushedAt
  defaultBranchRef { name target { oid } }
  openIssues: issues(states: OPEN) { totalCount }
  closedIssues: issues(states: CLOSED) { totalCount }
  openPullRequests: pullRequests(states: OPEN) { totalCount }
  mergedPullRequests: pullRequests(states: MERGED) { totalCount }
  closedPullRequests: pullRequests(states: CLOSED) { totalCount }
  vulnerabilityAlerts(states: OPEN, first: 0) { totalCount }
}`;

/**
 * Build one aliased document for a chunk of repositories.
 *
 * Owner and name are validated against a strict pattern by the caller and
 * re-validated here; anything that fails is dropped rather than escaped, so
 * no caller-controlled text can alter the shape of the document.
 */
export function buildRepoStatsQuery(refs: readonly RepoRef[]): {
  query: string;
  aliases: Map<string, RepoRef>;
} {
  const aliases = new Map<string, RepoRef>();
  const selections: string[] = [];

  for (const ref of refs) {
    if (!isValidRepoRef(ref.owner, ref.name)) continue;
    const alias = `r${String(aliases.size)}`;
    aliases.set(alias, ref);
    selections.push(
      `  ${alias}: repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.name)}) { ...HubRepoStats }`,
    );
  }

  const query = [
    REPO_FRAGMENT,
    'query HubFleet {',
    '  rateLimit { cost remaining limit resetAt }',
    ...selections,
    '}',
  ].join('\n');

  return { query, aliases };
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function totalCount(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  return asNumber((value as { totalCount?: unknown }).totalCount);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

interface GraphQLError {
  message?: unknown;
  path?: unknown;
  type?: unknown;
}

function errorMessage(error: GraphQLError): string {
  const message = asString(error.message);
  if (message) return message;
  const type = asString(error.type);
  return type ?? 'unknown GraphQL error';
}

/**
 * Interpret a GraphQL response that may contain `data` AND `errors` at once.
 *
 * GitHub answers a partially-failing batch with both: repositories that
 * resolved appear under `data`, and each failed alias gets its own entry in
 * `errors`. A field-level failure (typically unreadable Dependabot alerts)
 * nulls only that field and keeps the rest of the repository usable.
 */
export function parseRepoStatsResponse(
  raw: unknown,
  aliases: Map<string, RepoRef>,
): { stats: Map<string, RepoStats>; repoErrors: Map<string, string>; globalErrors: string[]; rateLimit: RateLimitInfo | null } {
  const stats = new Map<string, RepoStats>();
  const repoErrors = new Map<string, string>();
  const globalErrors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { stats, repoErrors, globalErrors: ['gh returned a non-object response'], rateLimit: null };
  }

  const body = raw as { data?: unknown; errors?: unknown; message?: unknown };
  const data =
    typeof body.data === 'object' && body.data !== null
      ? (body.data as Record<string, unknown>)
      : null;

  const fieldErrors = new Map<string, string[]>();
  if (Array.isArray(body.errors)) {
    for (const entry of body.errors as GraphQLError[]) {
      const message = errorMessage(entry);
      const path = Array.isArray(entry.path) ? entry.path : [];
      const alias = typeof path[0] === 'string' ? path[0] : null;
      const ref = alias ? aliases.get(alias) : undefined;
      if (!alias || !ref) {
        globalErrors.push(message);
        continue;
      }
      if (path.length > 1) {
        const bucket = fieldErrors.get(alias) ?? [];
        bucket.push(`${String(path.slice(1).join('.'))}: ${message}`);
        fieldErrors.set(alias, bucket);
        continue;
      }
      repoErrors.set(repoKey(ref), message);
    }
  }

  if (!data && globalErrors.length === 0 && typeof body.message === 'string') {
    globalErrors.push(body.message);
  }

  const rateLimitNode = data?.['rateLimit'];
  let rateLimit: RateLimitInfo | null = null;
  if (typeof rateLimitNode === 'object' && rateLimitNode !== null) {
    const node = rateLimitNode as Record<string, unknown>;
    rateLimit = {
      cost: asNumber(node['cost']) ?? 0,
      remaining: asNumber(node['remaining']) ?? 0,
      limit: asNumber(node['limit']) ?? 0,
      resetAt: asString(node['resetAt']),
    };
  }

  for (const [alias, ref] of aliases) {
    const key = repoKey(ref);
    const node = data?.[alias];
    if (typeof node !== 'object' || node === null) {
      if (!repoErrors.has(key)) {
        repoErrors.set(key, 'repository not found or not visible to the signed-in gh account');
      }
      continue;
    }

    const repo = node as Record<string, unknown>;
    const defaultBranchRef =
      typeof repo['defaultBranchRef'] === 'object' && repo['defaultBranchRef'] !== null
        ? (repo['defaultBranchRef'] as Record<string, unknown>)
        : null;
    const target =
      defaultBranchRef && typeof defaultBranchRef['target'] === 'object' && defaultBranchRef['target'] !== null
        ? (defaultBranchRef['target'] as Record<string, unknown>)
        : null;

    const partial = fieldErrors.get(alias) ?? [];
    const alerts = totalCount(repo['vulnerabilityAlerts']);
    if (alerts === null && partial.length === 0) {
      partial.push('vulnerabilityAlerts: not readable with the current gh credentials');
    }

    stats.set(key, {
      nameWithOwner: asString(repo['nameWithOwner']) ?? `${ref.owner}/${ref.name}`,
      url: asString(repo['url']) ?? `https://github.com/${ref.owner}/${ref.name}`,
      isArchived: repo['isArchived'] === true,
      isPrivate: repo['isPrivate'] === true,
      isFork: repo['isFork'] === true,
      pushedAt: asString(repo['pushedAt']),
      defaultBranch: defaultBranchRef ? asString(defaultBranchRef['name']) : null,
      defaultBranchOid: target ? asString(target['oid']) : null,
      openIssues: totalCount(repo['openIssues']) ?? 0,
      closedIssues: totalCount(repo['closedIssues']) ?? 0,
      openPullRequests: totalCount(repo['openPullRequests']) ?? 0,
      mergedPullRequests: totalCount(repo['mergedPullRequests']) ?? 0,
      closedPullRequests: totalCount(repo['closedPullRequests']) ?? 0,
      securityAlerts: alerts,
      partial,
    });
  }

  return { stats, repoErrors, globalErrors, rateLimit };
}

/** Turn whatever gh printed on stderr into an actionable reason. */
export function classifyGhFailure(
  stderr: string,
  spawnError: NodeJS.ErrnoException | null,
  timedOut: boolean,
): GhFailure {
  if (spawnError) {
    if (spawnError.code === 'ENOENT') {
      return {
        kind: 'not-installed',
        message: 'gh is not installed or not on PATH. Install the GitHub CLI to see repository data.',
      };
    }
    return { kind: 'unknown', message: spawnError.message };
  }
  if (timedOut) {
    return { kind: 'timeout', message: 'gh did not answer in time' };
  }

  const text = stderr.trim();
  if (/gh auth login|not logged in|authentication required|requires authentication|HTTP 401|bad credentials/i.test(text)) {
    return {
      kind: 'not-authenticated',
      message: 'gh is installed but not authenticated. Run `gh auth login` once.',
    };
  }
  if (/rate limit|secondary rate|HTTP 403/i.test(text)) {
    return { kind: 'rate-limited', message: text || 'GitHub rate limit reached' };
  }
  if (/dial tcp|no such host|getaddrinfo|ENOTFOUND|connection refused|network is unreachable|TLS handshake|i\/o timeout|EOF/i.test(text)) {
    return { kind: 'network', message: text || 'GitHub is unreachable' };
  }
  return { kind: 'unknown', message: text || 'gh failed without a message' };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) return [[...items]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * How a GraphQL document is executed. Injectable so the degradation paths
 * (no gh, unauthenticated gh, partial errors) can be tested offline.
 */
export type GraphQLRunner = (query: string) => Promise<CommandResult>;

/**
 * Execute one GraphQL document through `gh`.
 *
 * The document travels on stdin (`--input -`) rather than in argv: it never
 * touches a shell, and it cannot hit the Windows command-line length limit.
 * gh supplies its own credentials, so no token is read or held by this process.
 */
export const ghGraphQLRunner: GraphQLRunner = (query) =>
  runCommand('gh', ['api', 'graphql', '--input', '-'], {
    stdin: JSON.stringify({ query }),
    timeoutMs: GH_TIMEOUT_MS,
  });

/**
 * gh exits non-zero on a partially-failing batch while still printing the full
 * JSON body, so stdout is parsed regardless of the exit code.
 */
async function runGraphQL(
  query: string,
  runner: GraphQLRunner,
): Promise<{ body: unknown; failure: GhFailure | null }> {
  const result = await runner(query);

  let body: unknown = null;
  const text = result.stdout.trim();
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (body !== null) {
    return { body, failure: null };
  }
  if (result.code === 0) {
    return { body: null, failure: { kind: 'unknown', message: 'gh returned an empty response' } };
  }
  return { body: null, failure: classifyGhFailure(result.stderr, result.spawnError, result.timedOut) };
}

/**
 * Fetch stats for every mapped repository.
 *
 * Failure is always partial-tolerant: whatever resolved is returned, and the
 * caller keeps its previous values for the rest rather than showing zeros.
 */
export async function fetchRepoStats(
  refs: readonly RepoRef[],
  options: { chunkSize?: number; runner?: GraphQLRunner } = {},
): Promise<RepoStatsResult> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const runner = options.runner ?? ghGraphQLRunner;
  const stats = new Map<string, RepoStats>();
  const repoErrors = new Map<string, string>();
  const failures: GhFailure[] = [];
  let rateLimit: RateLimitInfo | null = null;

  const valid = refs.filter((ref) => isValidRepoRef(ref.owner, ref.name));
  if (valid.length === 0) {
    return { stats, repoErrors, failures, rateLimit };
  }

  for (const batch of chunk(valid, chunkSize)) {
    const { query, aliases } = buildRepoStatsQuery(batch);
    const { body, failure } = await runGraphQL(query, runner);
    if (failure) {
      failures.push(failure);
      continue;
    }
    const parsed = parseRepoStatsResponse(body, aliases);
    for (const [key, value] of parsed.stats) stats.set(key, value);
    for (const [key, value] of parsed.repoErrors) repoErrors.set(key, value);
    for (const message of parsed.globalErrors) {
      failures.push({ kind: 'unknown', message });
    }
    if (parsed.rateLimit) rateLimit = parsed.rateLimit;
  }

  return { stats, repoErrors, failures, rateLimit };
}
