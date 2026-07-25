'use client';

import React, { useEffect, useState } from 'react';
import type { FleetOverview, FleetRow } from '@/lib/fleet';
import type { ProjectRemote } from '@/lib/git-remote';
import { RelativeTime } from './timestamp';

/**
 * Repository and checkout state for a single project, loaded after the page
 * renders so the handoff view is never blocked on the network.
 */

function Stat({
  label,
  value,
  tone = 'text-tx',
  note,
  title,
}: {
  label: string;
  value: string;
  tone?: string;
  note: string;
  title?: string;
}): React.ReactElement {
  return (
    <div className="rounded-[var(--r)] border border-br bg-[var(--c2)]/35 p-3" title={title}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] text-dim">{note}</div>
    </div>
  );
}

function NotApplicablePanel({ remote }: { remote: ProjectRemote }): React.ReactElement {
  const detail =
    remote.kind === 'other-host'
      ? `The origin remote points at ${remote.host ?? 'another host'}, so GitHub issues, pull requests and Dependabot alerts do not apply to this project.`
      : remote.kind === 'unmappable'
        ? 'The origin remote could not be mapped to a GitHub repository.'
        : 'This checkout has no git remote, so there is no repository to report on.';
  return (
    <div className="rounded-[var(--r)] border border-dashed border-br bg-[var(--c2)]/25 p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-dim">not applicable</div>
      <p className="mt-2 text-[var(--fs-xs)] leading-5 text-sec">{detail}</p>
      {remote.url && <p className="mt-2 break-all font-mono text-[10px] text-dim">origin: {remote.url}</p>}
    </div>
  );
}

export function ProjectRepositoryPanel({
  projectId,
  remote,
}: {
  projectId: string;
  remote: ProjectRemote;
}): React.ReactElement {
  const [row, setRow] = useState<FleetRow | null>(null);
  const [meta, setMeta] = useState<FleetOverview['github'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fleet', { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as FleetOverview | { error?: string };
        if (cancelled) return;
        if (!response.ok || !('rows' in body)) {
          setError('error' in body && body.error ? body.error : 'could not load repository data');
          return;
        }
        setRow(body.rows.find((item) => item.id === projectId) ?? null);
        setMeta(body.github);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (remote.kind !== 'github') {
    return <NotApplicablePanel remote={remote} />;
  }

  if (!loaded) {
    return (
      <p className="animate-pulse font-mono text-[var(--fs-xs)] text-dim">
        Reading {remote.repo} from the gh CLI...
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-[var(--r)] border border-[rgba(255,77,109,0.4)] bg-[var(--er-soft)] p-3 font-mono text-[var(--fs-xs)] text-er">
        Repository data unavailable: {error}
      </p>
    );
  }

  const stats = row?.github ?? null;
  const checkout = row?.checkout ?? null;

  return (
    <div className="space-y-3">
      {row?.githubError && (
        <p className="rounded-[var(--r)] border border-[rgba(255,183,3,0.4)] bg-[var(--warn-soft)] p-3 font-mono text-[var(--fs-xs)] text-warn">
          {remote.repo}: {row.githubError}
        </p>
      )}
      {!stats && !row?.githubError && (
        <p className="rounded-[var(--r)] border border-[rgba(255,183,3,0.4)] bg-[var(--warn-soft)] p-3 font-mono text-[var(--fs-xs)] text-warn">
          No GitHub data yet{meta?.reason ? `: ${meta.reason}` : '.'}
        </p>
      )}

      {stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Open issues"
              value={String(stats.openIssues)}
              tone={stats.openIssues > 0 ? 'text-cy' : 'text-dim'}
              note={`${String(stats.closedIssues)} closed`}
            />
            <Stat
              label="Open pull requests"
              value={String(stats.openPullRequests)}
              tone={stats.openPullRequests > 0 ? 'text-cy' : 'text-dim'}
              note={`${String(stats.mergedPullRequests)} merged, ${String(stats.closedPullRequests)} closed without merging`}
              title="GitHub's CLOSED pull request state excludes merged pull requests, so these are counted separately."
            />
            <Stat
              label="Security alerts"
              value={stats.securityAlerts === null ? 'unknown' : String(stats.securityAlerts)}
              tone={
                stats.securityAlerts === null
                  ? 'text-warn'
                  : stats.securityAlerts > 0
                    ? 'text-er'
                    : 'text-ok'
              }
              note={
                stats.securityAlerts === null
                  ? 'not readable with the current gh credentials'
                  : 'open Dependabot alerts'
              }
            />
            <Stat
              label="Checkout drift"
              value={
                !checkout || checkout.error
                  ? 'unknown'
                  : checkout.upstream === null
                    ? 'no upstream'
                    : `${String(checkout.behind ?? 0)} behind`
              }
              tone={
                checkout && !checkout.error && (checkout.behind ?? 0) > 0 ? 'text-er' : 'text-dim'
              }
              note={
                checkout && !checkout.error
                  ? `${String(checkout.ahead ?? 0)} ahead, ${String(checkout.dirtyFiles)} uncommitted`
                  : (checkout?.error ?? 'no local checkout information')
              }
              title="Measured against the remote-tracking branch as of the last fetch. This dashboard never fetches."
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-dim">
            <span>
              repository: <span className="text-sec">{stats.nameWithOwner}</span>
              {stats.isArchived && <span className="ml-1 text-warn">(archived)</span>}
              {stats.isPrivate && <span className="ml-1 text-dim">(private)</span>}
            </span>
            {stats.pushedAt && (
              <span>
                last push: <RelativeTime iso={stats.pushedAt} />
              </span>
            )}
            {row?.githubFetchedAt && (
              <span>
                fetched: <RelativeTime iso={row.githubFetchedAt} />
                {meta?.stale ? <span className="ml-1 text-warn">(stale)</span> : null}
              </span>
            )}
            {checkout?.lastFetchAt && (
              <span>
                checkout last fetched: <RelativeTime iso={checkout.lastFetchAt} />
              </span>
            )}
            <span>
              mapped from: <span className="text-sec">{remote.source === 'manifest' ? 'MANIFEST github_repo' : `git remote ${remote.remoteName ?? 'origin'}`}</span>
            </span>
          </div>

          {stats.partial.length > 0 && (
            <ul className="space-y-1 font-mono text-[10px] text-warn/80">
              {stats.partial.map((note) => (
                <li key={note}>partial: {note}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
