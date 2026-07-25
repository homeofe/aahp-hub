import 'server-only';
import { readCheckoutStatuses, type CheckoutStatus } from './checkout';
import { getRepoStats, type GitHubOverviewData } from './github-cache';
import { parseRepoRef, repoKey, type RepoRef, type RepoStats } from './github-stats';
import type { ProjectRemote } from './git-remote';

/**
 * Joins the three sources the daily overview needs into one row per project:
 * the local handoff state, the local checkout state, and GitHub.
 *
 * Every value carries its own provenance. "Not applicable", "no data yet" and
 * a real zero are three distinct states here and stay distinct all the way
 * into the UI.
 */

export type FleetSegment =
  /** Live GitHub repository. */
  | 'active'
  /** Archived on GitHub. */
  | 'archived'
  /** No GitHub origin: migrated to another forge, or not a git checkout. */
  | 'not-applicable';

export type AttentionKind =
  | 'security'
  | 'behind'
  | 'no-upstream'
  | 'dirty'
  | 'open-prs'
  | 'stale-handoff'
  | 'github-error';

export type AttentionLevel = 'high' | 'medium' | 'low';

export interface AttentionSignal {
  kind: AttentionKind;
  level: AttentionLevel;
  label: string;
}

export interface FleetRow {
  id: string;
  name: string;
  segment: FleetSegment;
  remote: ProjectRemote;
  github: RepoStats | null;
  /** When this repository's numbers were last read from GitHub. */
  githubFetchedAt: string | null;
  /** Per-repository failure, e.g. renamed or no longer visible. */
  githubError: string | null;
  checkout: CheckoutStatus | null;
  /**
   * True when the checked-out branch is the repository default branch but sits
   * on a different commit than GitHub reports. Unlike the ahead/behind counts
   * this does not depend on when the checkout last fetched. Null when it
   * cannot be determined.
   */
  offDefaultTip: boolean | null;
  attention: AttentionSignal[];
  attentionScore: number;
}

export interface FleetGitHubMeta {
  /** False when gh is missing, unauthenticated, or every request failed. */
  available: boolean;
  /** Human readable reason when unavailable. */
  reason: string | null;
  failureKind: string | null;
  lastSuccessAt: string | null;
  stale: boolean;
  source: GitHubOverviewData['source'];
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
  /** Repositories the hub asked GitHub about. */
  requested: number;
  /** Repositories GitHub answered for. */
  answered: number;
}

export interface FleetOverview {
  rows: FleetRow[];
  github: FleetGitHubMeta;
  counts: Record<FleetSegment, number>;
  generatedAt: string;
}

export interface FleetProjectInput {
  id: string;
  name: string;
  path: string;
  remote: ProjectRemote;
  handoffModifiedAt: string | null;
}

const STALE_HANDOFF_DAYS = 14;

const LEVEL_WEIGHT: Record<AttentionLevel, number> = { high: 100, medium: 30, low: 5 };

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return (now - parsed) / (1000 * 60 * 60 * 24);
}

/**
 * Rank a project by how loudly it is asking for attention. Security alerts
 * outrank everything; a checkout that has drifted from its remote outranks a
 * simple review backlog, because it silently invalidates the rest of the row.
 */
export function computeAttention(
  row: Pick<FleetRow, 'github' | 'checkout' | 'githubError' | 'segment'>,
  handoffModifiedAt: string | null,
  now: number = Date.now(),
): { signals: AttentionSignal[]; score: number } {
  const signals: AttentionSignal[] = [];

  const alerts = row.github?.securityAlerts ?? null;
  if (alerts !== null && alerts > 0) {
    signals.push({
      kind: 'security',
      level: 'high',
      label: `${String(alerts)} open security alert${alerts === 1 ? '' : 's'}`,
    });
  }

  const behind = row.checkout?.behind ?? null;
  if (behind !== null && behind > 0) {
    signals.push({
      kind: 'behind',
      level: behind >= 10 ? 'high' : 'medium',
      label: `checkout is ${String(behind)} commit${behind === 1 ? '' : 's'} behind its remote`,
    });
  } else if (row.checkout && !row.checkout.error && row.checkout.upstream === null && !row.checkout.detached) {
    signals.push({
      kind: 'no-upstream',
      level: 'low',
      label: 'branch has no upstream, drift cannot be measured',
    });
  }

  const dirty = row.checkout?.dirtyFiles ?? 0;
  if (dirty > 0) {
    signals.push({
      kind: 'dirty',
      level: 'low',
      label: `${String(dirty)} uncommitted file${dirty === 1 ? '' : 's'}`,
    });
  }

  const openPrs = row.github?.openPullRequests ?? 0;
  if (openPrs > 0) {
    signals.push({
      kind: 'open-prs',
      level: openPrs >= 3 ? 'medium' : 'low',
      label: `${String(openPrs)} open pull request${openPrs === 1 ? '' : 's'}`,
    });
  }

  const handoffAge = daysSince(handoffModifiedAt, now);
  if (handoffAge !== null && handoffAge >= STALE_HANDOFF_DAYS) {
    signals.push({
      kind: 'stale-handoff',
      level: 'low',
      label: `handoff untouched for ${String(Math.round(handoffAge))} days`,
    });
  }

  if (row.githubError) {
    signals.push({ kind: 'github-error', level: 'medium', label: row.githubError });
  }

  const score = signals.reduce((sum, signal) => sum + LEVEL_WEIGHT[signal.level], 0);
  return { signals, score };
}

export function segmentFor(remote: ProjectRemote, stats: RepoStats | null): FleetSegment {
  if (remote.kind !== 'github') return 'not-applicable';
  if (stats?.isArchived === true) return 'archived';
  return 'active';
}

function compareRows(a: FleetRow, b: FleetRow): number {
  if (a.attentionScore !== b.attentionScore) return b.attentionScore - a.attentionScore;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function collectRepoRefs(projects: readonly FleetProjectInput[]): RepoRef[] {
  const seen = new Map<string, RepoRef>();
  for (const project of projects) {
    if (project.remote.kind !== 'github' || !project.remote.repo) continue;
    const ref = parseRepoRef(project.remote.repo);
    if (!ref) continue;
    seen.set(repoKey(ref), ref);
  }
  return [...seen.values()];
}

/** Only true when we can be certain, so an unknown never reads as a problem. */
export function computeOffDefaultTip(
  checkout: CheckoutStatus | null,
  stats: RepoStats | null,
): boolean | null {
  if (!checkout || checkout.error || !checkout.head) return null;
  if (!stats?.defaultBranch || !stats.defaultBranchOid) return null;
  if (checkout.detached || checkout.branch !== stats.defaultBranch) return null;
  return checkout.head !== stats.defaultBranchOid;
}

export function buildFleetRows(
  projects: readonly FleetProjectInput[],
  github: GitHubOverviewData,
  checkouts: Map<string, CheckoutStatus>,
  now: number = Date.now(),
): FleetRow[] {
  const rows = projects.map((project) => {
    const key = project.remote.repo ? project.remote.repo.toLowerCase() : null;
    const entry = key ? github.entries.get(key) : undefined;
    const failure = key ? github.repoErrors.get(key) : undefined;
    const stats = entry?.stats ?? null;
    const checkout = checkouts.get(project.path) ?? null;
    const segment = segmentFor(project.remote, stats);
    const githubError = failure?.message ?? null;

    const base = {
      id: project.id,
      name: project.name,
      segment,
      remote: project.remote,
      github: stats,
      githubFetchedAt: entry?.fetchedAt ?? null,
      githubError,
      checkout,
      offDefaultTip: computeOffDefaultTip(checkout, stats),
    };

    const { signals, score } = computeAttention(base, project.handoffModifiedAt, now);
    return { ...base, attention: signals, attentionScore: score };
  });

  rows.sort(compareRows);
  return rows;
}

function describeFailure(github: GitHubOverviewData): { available: boolean; reason: string | null } {
  if (github.entries.size > 0) {
    return { available: true, reason: github.failure ? github.failure.message : null };
  }
  if (github.failure) {
    return { available: false, reason: github.failure.message };
  }
  if (github.source === 'empty') {
    return { available: false, reason: 'no GitHub data has been fetched yet' };
  }
  return { available: true, reason: null };
}

/**
 * Build the whole overview. Safe to call on every request: the GitHub layer is
 * TTL cached and de-duplicated, and the checkout scan is bounded.
 */
export async function buildFleetOverview(
  projects: readonly FleetProjectInput[],
  options: { force?: boolean } = {},
): Promise<FleetOverview> {
  const refs = collectRepoRefs(projects);
  const force = options.force ?? false;
  const [github, checkouts] = await Promise.all([
    getRepoStats(refs, { force }),
    // A forced refresh should also re-read the local checkouts, so the button
    // means "everything on this row is current".
    readCheckoutStatuses(
      projects.map((project) => project.path),
      { force },
    ),
  ]);

  const rows = buildFleetRows(projects, github, checkouts);
  const counts: Record<FleetSegment, number> = { active: 0, archived: 0, 'not-applicable': 0 };
  for (const row of rows) counts[row.segment] += 1;

  const { available, reason } = describeFailure(github);

  return {
    rows,
    counts,
    generatedAt: new Date().toISOString(),
    github: {
      available,
      reason,
      failureKind: github.failure?.kind ?? null,
      lastSuccessAt: github.lastSuccessAt,
      stale: github.stale,
      source: github.source,
      rateLimitRemaining: github.rateLimit?.remaining ?? null,
      rateLimitLimit: github.rateLimit?.limit ?? null,
      requested: refs.length,
      answered: github.entries.size,
    },
  };
}
