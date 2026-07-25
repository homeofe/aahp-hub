'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FleetOverview, FleetRow, FleetSegment } from '@/lib/fleet';
import type { ProjectRemote } from '@/lib/git-remote';
import { HealthBadge } from './health-badge';
import { PROJECT_EXPLORER_EVENT, type ProjectExplorerDetail } from './project-explorer-events';
import { RelativeTime } from './timestamp';

/**
 * The daily driver.
 *
 * Local handoff state is server rendered and painted immediately; the GitHub
 * and checkout columns arrive afterwards from /api/fleet and fill in.
 *
 * Three empty-ish states are deliberately distinguished everywhere:
 *   n/a      this project has no GitHub remote, the question does not apply
 *   ...      not fetched yet
 *   0        a real, fetched zero
 */

export interface FleetSeedProject {
  id: string;
  name: string;
  phase: string;
  lastAgent: string;
  readyTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  totalTasks: number;
  isRunning: boolean;
  recentlyActive: boolean;
  lastUpdated: string;
  handoffModifiedAt: string | null;
  worktreeCount: number;
  health: number;
  grade: string;
  remote: ProjectRemote;
}

type StatusFilter = 'all' | 'active' | 'running' | 'has-tasks' | 'dormant';
type SortMode = 'attention' | 'updated' | 'name' | 'tasks';
type SegmentFilter = FleetSegment | 'all';

const STATUS_FILTERS: { id: StatusFilter; label: string; title: string }[] = [
  { id: 'all', label: 'All', title: 'Every scanned project' },
  { id: 'active', label: 'Active', title: 'Running, actionable, or updated within 7 days' },
  { id: 'running', label: '◉ Running', title: 'An agent is running right now' },
  { id: 'has-tasks', label: '⚡ Actionable', title: 'Has ready or in-progress tasks' },
  { id: 'dormant', label: 'Dormant', title: 'No tasks and no recent activity' },
];

const SEGMENTS: { id: SegmentFilter; label: string; title: string }[] = [
  { id: 'active', label: 'On GitHub', title: 'Live GitHub repositories' },
  { id: 'archived', label: 'Archived', title: 'Archived on GitHub, kept for reference' },
  {
    id: 'not-applicable',
    label: 'Not on GitHub',
    title: 'Migrated to another forge, or not a git checkout. GitHub columns do not apply.',
  },
  { id: 'all', label: 'All', title: 'Everything the scan found' },
];

const GRID =
  'grid grid-cols-[2.25rem_minmax(11rem,1.5fr)_7rem_6.5rem_9.5rem_5rem_10rem_7rem_5.5rem] gap-x-3 items-center';

/** Well inside the server-side GitHub TTL, so most polls cost no gh call. */
const POLL_INTERVAL_MS = 60_000;

function statusOf(project: FleetSeedProject): StatusFilter {
  if (project.isRunning) return 'running';
  if (project.readyTasks + project.inProgressTasks > 0) return 'has-tasks';
  return 'dormant';
}

function statusLabel(project: FleetSeedProject): { label: string; className: string } {
  if (project.isRunning) return { label: 'running', className: 'text-ok' };
  if (project.inProgressTasks > 0) return { label: 'in progress', className: 'text-warn' };
  if (project.readyTasks > 0) return { label: 'ready', className: 'text-cy' };
  if (project.recentlyActive) return { label: 'recent', className: 'text-cy' };
  return { label: 'dormant', className: 'text-dim' };
}

function accentFor(row: FleetRow | undefined): string {
  if (!row || row.attention.length === 0) return 'border-l-transparent';
  if (row.attention.some((signal) => signal.level === 'high')) return 'border-l-[var(--er)]';
  if (row.attention.some((signal) => signal.level === 'medium')) return 'border-l-[var(--warn)]';
  return 'border-l-[rgba(107,130,168,0.5)]';
}

/** "no GitHub remote" - the question does not apply to this project. */
function NotApplicable({ reason }: { reason: string }): React.ReactElement {
  return (
    <span className="font-mono text-[10px] text-dim/70" title={reason}>
      n/a
    </span>
  );
}

/** "not fetched yet" - never rendered as a zero. */
function Pending(): React.ReactElement {
  return (
    <span className="font-mono text-[10px] text-dim/60 animate-pulse" title="Loading from the gh CLI">
      {'···'}
    </span>
  );
}

function Unknown({ reason }: { reason: string }): React.ReactElement {
  return (
    <span className="font-mono text-[10px] text-warn/80" title={reason}>
      {'?'}
    </span>
  );
}

async function fetchFleet(force: boolean): Promise<FleetOverview> {
  const response = await fetch(force ? '/api/fleet?refresh=1' : '/api/fleet', { cache: 'no-store' });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `request failed with ${String(response.status)}`;
    throw new Error(message);
  }
  return body as FleetOverview;
}

function remoteReason(remote: ProjectRemote): string {
  if (remote.kind === 'other-host') {
    return `origin points at ${remote.host ?? 'another host'}, not GitHub. This project was migrated off GitHub.`;
  }
  if (remote.kind === 'unmappable') {
    return `origin (${remote.url ?? 'unknown'}) could not be mapped to a GitHub repository.`;
  }
  return 'no git remote: this checkout does not track a repository.';
}

interface CellProps {
  project: FleetSeedProject;
  row: FleetRow | undefined;
  loaded: boolean;
}

function IssuesCell({ project, row, loaded }: CellProps): React.ReactElement {
  if (project.remote.kind !== 'github') return <NotApplicable reason={remoteReason(project.remote)} />;
  if (row?.githubError) return <Unknown reason={row.githubError} />;
  if (!row?.github) return loaded ? <Unknown reason="GitHub data unavailable" /> : <Pending />;
  const { openIssues, closedIssues } = row.github;
  return (
    <span
      className="font-mono text-[11px] tabular-nums"
      title={`${String(openIssues)} open, ${String(closedIssues)} closed`}
    >
      <span className={openIssues > 0 ? 'font-bold text-tx' : 'text-dim'}>{openIssues}</span>
      <span className="text-dim/60"> / {closedIssues}</span>
    </span>
  );
}

function PullRequestsCell({ project, row, loaded }: CellProps): React.ReactElement {
  if (project.remote.kind !== 'github') return <NotApplicable reason={remoteReason(project.remote)} />;
  if (row?.githubError) return <Unknown reason={row.githubError} />;
  if (!row?.github) return loaded ? <Unknown reason="GitHub data unavailable" /> : <Pending />;
  const { openPullRequests, mergedPullRequests, closedPullRequests } = row.github;
  return (
    <span
      className="font-mono text-[11px] tabular-nums"
      title={[
        `${String(openPullRequests)} open`,
        `${String(mergedPullRequests)} merged`,
        `${String(closedPullRequests)} closed without merging`,
      ].join(', ')}
    >
      <span className={openPullRequests > 0 ? 'font-bold text-cy' : 'text-dim'}>{openPullRequests}</span>
      <span className="text-dim/50"> / </span>
      <span className={mergedPullRequests > 0 ? 'text-ok' : 'text-dim'}>{mergedPullRequests}</span>
      <span className="text-dim/50"> / </span>
      <span className={closedPullRequests > 0 ? 'text-sec' : 'text-dim'}>{closedPullRequests}</span>
    </span>
  );
}

function SecurityCell({ project, row, loaded }: CellProps): React.ReactElement {
  if (project.remote.kind !== 'github') return <NotApplicable reason={remoteReason(project.remote)} />;
  if (row?.githubError) return <Unknown reason={row.githubError} />;
  if (!row?.github) return loaded ? <Unknown reason="GitHub data unavailable" /> : <Pending />;
  const alerts = row.github.securityAlerts;
  if (alerts === null) {
    return <Unknown reason="Dependabot alerts are not readable with the current gh credentials" />;
  }
  return (
    <span
      className={`font-mono text-[11px] tabular-nums ${alerts > 0 ? 'font-bold text-er' : 'text-dim'}`}
      title={`${String(alerts)} open Dependabot alert${alerts === 1 ? '' : 's'}`}
    >
      {alerts}
    </span>
  );
}

function CheckoutCell({ row, loaded }: { row: FleetRow | undefined; loaded: boolean }): React.ReactElement {
  if (!row?.checkout) return loaded ? <Unknown reason="checkout state unavailable" /> : <Pending />;
  const checkout = row.checkout;

  if (checkout.error) {
    return (
      <span className="font-mono text-[10px] text-dim" title={checkout.error}>
        not a checkout
      </span>
    );
  }

  const fetched = checkout.lastFetchAt
    ? `remote refs last fetched ${new Date(checkout.lastFetchAt).toLocaleString()}`
    : 'this checkout has never fetched';
  const dirty = checkout.dirtyFiles > 0 ? ` / ${String(checkout.dirtyFiles)} uncommitted` : '';

  if (checkout.detached) {
    return (
      <span className="font-mono text-[10px] text-warn" title={`detached HEAD. ${fetched}`}>
        detached HEAD{dirty}
      </span>
    );
  }
  if (checkout.upstream === null) {
    return (
      <span
        className="font-mono text-[10px] text-warn/90"
        title={`branch ${checkout.branch ?? '?'} has no upstream, so drift cannot be measured. ${fetched}`}
      >
        no upstream{dirty}
      </span>
    );
  }

  const behind = checkout.behind ?? 0;
  const ahead = checkout.ahead ?? 0;
  const tip = row.offDefaultTip === true ? ' (off default tip)' : '';
  const title = `${checkout.branch ?? 'HEAD'} vs ${checkout.upstream}: ${String(behind)} behind, ${String(ahead)} ahead${tip}. ${fetched}`;

  if (behind > 0) {
    return (
      <span className={`font-mono text-[11px] ${behind >= 10 ? 'font-bold text-er' : 'text-warn'}`} title={title}>
        {behind} behind
        {ahead > 0 && <span className="text-dim"> +{ahead}</span>}
        {checkout.dirtyFiles > 0 && <span className="text-dim"> {'●'}</span>}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] text-dim" title={title}>
      {ahead > 0 ? `${String(ahead)} ahead` : 'in sync'}
      {checkout.dirtyFiles > 0 && <span className="text-warn"> {'●'}</span>}
    </span>
  );
}

function FreshnessBar({
  fleet,
  loaded,
  error,
  refreshing,
  onRefresh,
  scannedAt,
}: {
  fleet: FleetOverview | null;
  loaded: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  scannedAt: string;
}): React.ReactElement {
  const meta = fleet?.github ?? null;

  let tone = 'border-br bg-[var(--c1)]';
  let headline: React.ReactNode = 'Reading repository state from the gh CLI...';

  if (error) {
    tone = 'border-[rgba(255,77,109,0.4)] bg-[var(--er-soft)]';
    headline = <span className="text-er">GitHub columns unavailable: {error}</span>;
  } else if (meta && !meta.available) {
    tone = 'border-[rgba(255,183,3,0.4)] bg-[var(--warn-soft)]';
    headline = <span className="text-warn">GitHub columns unavailable: {meta.reason}</span>;
  } else if (meta?.stale) {
    tone = 'border-[rgba(255,183,3,0.4)] bg-[var(--warn-soft)]';
    headline = (
      <span className="text-warn">
        Showing the last good GitHub values
        {meta.lastSuccessAt ? (
          <>
            {' '}
            from <RelativeTime iso={meta.lastSuccessAt} />
          </>
        ) : null}
        {meta.reason ? ` (refresh failed: ${meta.reason})` : ''}
      </span>
    );
  } else if (meta) {
    headline = (
      <span className="text-sec">
        GitHub data fetched{' '}
        {meta.lastSuccessAt ? <RelativeTime iso={meta.lastSuccessAt} /> : 'never'} via the gh CLI
        <span className="text-dim">
          {' '}
          ({meta.answered}/{meta.requested} repositories
          {meta.rateLimitRemaining !== null
            ? `, ${String(meta.rateLimitRemaining)}/${String(meta.rateLimitLimit ?? 0)} rate limit left`
            : ''}
          )
        </span>
      </span>
    );
  }

  return (
    <div
      className={`mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r)] border px-3 py-2 font-mono text-[var(--fs-xs)] ${tone}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {!loaded && !error ? <span className="h-2 w-2 animate-pulse rounded-full bg-cy" aria-hidden /> : null}
        {headline}
        <span className="text-dim">
          {'·'} handoff files read <RelativeTime iso={scannedAt} />
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="hub-link-btn"
        title="Re-run the batched GitHub query now instead of waiting for the cache to expire"
      >
        {refreshing ? 'refreshing...' : '↻ refresh repository data'}
      </button>
    </div>
  );
}

export function FleetBoard({
  projects,
  scannedAt,
}: {
  projects: FleetSeedProject[];
  scannedAt: string;
}): React.ReactElement {
  const [fleet, setFleet] = useState<FleetOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [segment, setSegment] = useState<SegmentFilter>('active');
  const [sortMode, setSortMode] = useState<SortMode>('attention');

  useEffect(() => {
    let cancelled = false;

    const pull = (): void => {
      fetchFleet(false)
        .then((data) => {
          if (cancelled) return;
          setFleet(data);
          setError(null);
        })
        .catch((err: unknown) => {
          // Keep whatever is already on screen; the freshness bar reports why
          // it may be out of date.
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!cancelled) setLoaded(true);
        });
    };

    pull();
    // The page's own auto-refresh re-renders server components but preserves
    // client state, so this poll is what keeps the repository columns current.
    // Inside the server-side TTL it is answered from cache without calling gh.
    const timer = setInterval(pull, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<ProjectExplorerDetail>).detail;
      setSearch(detail.project ?? '');
      setPhase(detail.phase ?? '');
      setStatus('all');
      setSegment('all');
    };
    window.addEventListener(PROJECT_EXPLORER_EVENT, handler);
    return () => window.removeEventListener(PROJECT_EXPLORER_EVENT, handler);
  }, []);

  const rowsById = useMemo(() => {
    const map = new Map<string, FleetRow>();
    for (const row of fleet?.rows ?? []) map.set(row.id, row);
    return map;
  }, [fleet]);

  const segmentOf = useCallback(
    (project: FleetSeedProject): FleetSegment => {
      const row = rowsById.get(project.id);
      if (row) return row.segment;
      return project.remote.kind === 'github' ? 'active' : 'not-applicable';
    },
    [rowsById],
  );

  const counts = useMemo(() => {
    const result: Record<FleetSegment, number> = { active: 0, archived: 0, 'not-applicable': 0 };
    for (const project of projects) result[segmentOf(project)] += 1;
    return result;
  }, [projects, segmentOf]);

  const needsAttention = useMemo(
    () =>
      projects.filter((project) => {
        const row = rowsById.get(project.id);
        return row ? row.attention.some((signal) => signal.level === 'high') : false;
      }).length,
    [projects, rowsById],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const phaseTerm = phase.trim().toLowerCase();

    const filtered = projects.filter((project) => {
      if (segment !== 'all' && segmentOf(project) !== segment) return false;
      if (term && !project.name.toLowerCase().includes(term)) return false;
      if (phaseTerm && project.phase.toLowerCase() !== phaseTerm) return false;
      const projectStatus = statusOf(project);
      if (status === 'all') return true;
      if (status === 'active') return projectStatus !== 'dormant' || project.recentlyActive;
      if (status === 'has-tasks') return projectStatus === 'running' || projectStatus === 'has-tasks';
      return projectStatus === status;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (sortMode === 'updated') {
        return (Date.parse(b.lastUpdated) || 0) - (Date.parse(a.lastUpdated) || 0);
      }
      if (sortMode === 'tasks') {
        const scoreA = a.readyTasks + a.inProgressTasks;
        const scoreB = b.readyTasks + b.inProgressTasks;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      const attentionA = rowsById.get(a.id)?.attentionScore ?? 0;
      const attentionB = rowsById.get(b.id)?.attentionScore ?? 0;
      if (attentionA !== attentionB) return attentionB - attentionA;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [projects, search, phase, status, segment, sortMode, segmentOf, rowsById]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFleet(true)
      .then((data) => {
        setFleet(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoaded(true);
        setRefreshing(false);
      });
  }, []);

  return (
    <section aria-label="Project fleet">
      <FreshnessBar
        fleet={fleet}
        loaded={loaded}
        error={error}
        refreshing={refreshing}
        onRefresh={onRefresh}
        scannedAt={scannedAt}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r)] border border-br bg-[var(--c1)] p-3 font-mono text-[var(--fs-sm)]">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Filter by name..."
            aria-label="Filter projects by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-56 rounded-[var(--r)] border border-br bg-[var(--c2)] px-3 py-1.5 text-[var(--fs-sm)] text-tx outline-none placeholder:text-dim focus:border-cy"
          />
          <div className="flex gap-1.5">
            {SEGMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.title}
                onClick={() => setSegment(item.id)}
                className={`hub-pill ${segment === item.id ? 'is-active' : ''}`}
              >
                {item.label}
                <span className="ml-1.5 text-dim">
                  {item.id === 'all' ? projects.length : counts[item.id]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.title}
                onClick={() => setStatus(item.id)}
                className={`hub-pill ${status === item.id ? 'is-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {phase && (
            <button type="button" onClick={() => setPhase('')} className="hub-pill is-active" title="Clear phase filter">
              phase: {phase} {'×'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-[var(--fs-xs)] text-sec">
          {needsAttention > 0 && (
            <span className="rounded border border-[rgba(255,77,109,0.4)] bg-[var(--er-soft)] px-2 py-0.5 text-er">
              {needsAttention} need{needsAttention === 1 ? 's' : ''} attention
            </span>
          )}
          <span className="tabular-nums text-dim">
            {visible.length} of {projects.length}
          </span>
          <select
            value={sortMode}
            aria-label="Sort projects"
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="rounded-[var(--r)] border border-br bg-[var(--c2)] px-2 py-1 text-tx outline-none focus:border-cy"
          >
            <option value="attention">Sort: needs attention</option>
            <option value="updated">Sort: last handoff update</option>
            <option value="tasks">Sort: open tasks</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--r-lg)] border border-br bg-[rgba(14,23,56,0.7)]">
        <div className="min-w-[1080px]">
          <div
            className={`${GRID} border-b border-br px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-dim`}
          >
            <span aria-hidden />
            <span>project</span>
            <span title="ready / in progress / done, from the local handoff MANIFEST">tasks</span>
            <span title="open / closed issues on GitHub">issues</span>
            <span title="open / merged / closed-without-merge. GitHub's CLOSED state excludes merged PRs, so these are three separate numbers.">
              prs o/m/c
            </span>
            <span title="Open Dependabot alerts">sec</span>
            <span title="Local checkout versus its remote-tracking branch. Measured from the last fetch, no network call is made.">
              checkout
            </span>
            <span title="When the local .ai/handoff/MANIFEST.json was last modified">handoff</span>
            <span>open</span>
          </div>

          {visible.length === 0 ? (
            <p className="px-3 py-8 text-center font-mono text-[var(--fs-sm)] text-dim">
              No projects match the current filters.
            </p>
          ) : (
            <div id="proj-grid">
              {visible.map((project) => {
                const row = rowsById.get(project.id);
                const label = statusLabel(project);
                const attentionTitle =
                  row && row.attention.length > 0
                    ? row.attention.map((signal) => signal.label).join(' / ')
                    : 'no outstanding signals';
                const progress =
                  project.totalTasks > 0 ? Math.round((project.doneTasks / project.totalTasks) * 100) : 100;

                return (
                  <div
                    key={project.id}
                    data-name={project.name}
                    data-phase={project.phase}
                    data-filter={statusOf(project)}
                    data-updated={project.lastUpdated}
                    data-recent={project.recentlyActive ? 'true' : 'false'}
                    data-segment={segmentOf(project)}
                    className={`${GRID} border-b border-l-2 border-br px-3 py-2 transition hover:bg-[var(--c2)]/50 ${accentFor(row)}`}
                  >
                    <HealthBadge score={project.health} grade={project.grade} size={26} />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8px] ${label.className}`} aria-hidden>
                          {'●'}
                        </span>
                        <Link
                          href={`/projects/${project.id}`}
                          className="truncate font-mono text-[var(--fs-sm)] font-bold text-tx hover:text-cy focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cy"
                          title={attentionTitle}
                        >
                          {project.name}
                        </Link>
                        {project.worktreeCount > 1 && (
                          <span
                            className="rounded border border-br px-1 font-mono text-[8px] text-dim"
                            title={`${String(project.worktreeCount)} checkouts of this project were found`}
                          >
                            {project.worktreeCount}x
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-dim">
                        <span className={label.className}>{label.label}</span>
                        <span>/</span>
                        <span className="truncate">{project.phase}</span>
                        {project.remote.kind !== 'github' && (
                          <>
                            <span>/</span>
                            <span className="truncate text-warn/70" title={remoteReason(project.remote)}>
                              {project.remote.kind === 'other-host' ? project.remote.host : 'no remote'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="font-mono text-[11px] tabular-nums" title={`${String(project.readyTasks)} ready, ${String(project.inProgressTasks)} in progress, ${String(project.doneTasks)} of ${String(project.totalTasks)} done`}>
                      <span className={project.readyTasks > 0 ? 'text-cy' : 'text-dim'}>{project.readyTasks}</span>
                      <span className="text-dim/50"> / </span>
                      <span className={project.inProgressTasks > 0 ? 'text-warn' : 'text-dim'}>
                        {project.inProgressTasks}
                      </span>
                      <span className="text-dim/60"> {'·'} {progress}%</span>
                    </div>

                    <IssuesCell project={project} row={row} loaded={loaded} />
                    <PullRequestsCell project={project} row={row} loaded={loaded} />
                    <SecurityCell project={project} row={row} loaded={loaded} />
                    <CheckoutCell row={row} loaded={loaded} />

                    <span
                      className="font-mono text-[10px] text-dim"
                      title={[
                        project.handoffModifiedAt
                          ? `MANIFEST.json modified ${new Date(project.handoffModifiedAt).toLocaleString()}`
                          : 'handoff modification time unavailable',
                        `last session: ${project.lastAgent}`,
                        project.lastUpdated
                          ? `recorded ${new Date(project.lastUpdated).toLocaleString()}`
                          : 'no session timestamp recorded',
                      ].join(' / ')}
                    >
                      {project.handoffModifiedAt ? <RelativeTime iso={project.handoffModifiedAt} /> : 'unknown'}
                    </span>

                    <span className="flex items-center gap-2 font-mono text-[10px]">
                      {project.remote.kind === 'github' && project.remote.repo ? (
                        <>
                          <a
                            className="text-dim hover:text-cy"
                            href={`https://github.com/${project.remote.repo}/issues`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open issues for ${project.remote.repo}`}
                          >
                            iss
                          </a>
                          <a
                            className="text-dim hover:text-cy"
                            href={`https://github.com/${project.remote.repo}/pulls`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open pull requests for ${project.remote.repo}`}
                          >
                            pr
                          </a>
                          <a
                            className="text-dim hover:text-er"
                            href={`https://github.com/${project.remote.repo}/security/dependabot`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Dependabot alerts for ${project.remote.repo}`}
                          >
                            sec
                          </a>
                        </>
                      ) : (
                        <span className="text-dim/50" title={remoteReason(project.remote)}>
                          {'–'}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 font-mono text-[9px] leading-4 text-dim">
        prs o/m/c = open / merged / closed without merging. GitHub reports merged pull requests separately from
        closed ones, so a repository can show 0 closed and still have dozens merged. checkout compares the local
        working copy with its remote-tracking branch from the last fetch; no fetch is performed by this dashboard.
        {counts['archived'] > 0 || counts['not-applicable'] > 0
          ? ` ${String(counts['archived'])} archived and ${String(counts['not-applicable'])} non-GitHub project(s) are filtered out of this view, not hidden: use the tabs above.`
          : ''}
      </p>
    </section>
  );
}
