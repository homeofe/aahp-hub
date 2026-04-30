import { scanProjects, type ProjectSummary, type TaskStatus } from '@/lib/manifest';
import { formatDuration, formatTokens, type TokenStats } from '@/lib/metrics';
import type { ActiveSession } from '@/lib/sessions';
import { AbortButton } from './abort-button';
import { AutoRefresh, LiveIndicator, RefreshButton } from './auto-refresh';
import { RelativeTime } from './timestamp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function statusColor(status: TaskStatus): string {
  switch (status) {
    case 'in_progress':
      return 'bg-status-progress/20 text-status-progress border-status-progress/40';
    case 'ready':
      return 'bg-status-ready/20 text-status-ready border-status-ready/40';
    case 'blocked':
      return 'bg-status-blocked/20 text-status-blocked border-status-blocked/40';
    case 'done':
      return 'bg-status-done/20 text-status-done border-status-done/40';
    default:
      return 'bg-bg-elevated text-text-dim border-border';
  }
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'done':
      return 'bg-status-done/20 text-status-done border-status-done/40';
    case 'in_progress':
    case 'implement':
    case 'architect':
    case 'research':
    case 'review':
      return 'bg-status-progress/20 text-status-progress border-status-progress/40';
    default:
      return 'bg-bg-elevated text-text-dim border-border';
  }
}

function tokensRecorded(stats: TokenStats): boolean {
  return (
    stats.recordedRuns > 0 &&
    (stats.inputTokens > 0 || stats.outputTokens > 0 || stats.cacheReadTokens > 0)
  );
}

function ProjectCard({
  project,
  controlPortAvailable,
}: {
  project: ProjectSummary;
  controlPortAvailable: boolean;
}): React.ReactElement {
  const isRunning = project.activeSessions.length > 0;
  const showTokens = project.metrics ? tokensRecorded(project.metrics.tokens) : false;
  return (
    <div
      className={`rounded-lg border ${
        isRunning ? 'border-status-done/60 shadow-[0_0_0_1px_rgba(74,222,128,0.15)]' : 'border-border'
      } bg-bg-card p-5 flex flex-col gap-3 hover:border-accent/50 transition-colors`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text truncate flex items-center gap-2" title={project.name}>
            {isRunning && (
              <span
                className="h-2 w-2 rounded-full bg-status-done shadow-[0_0_6px_rgba(74,222,128,0.7)] animate-pulse shrink-0"
                aria-label="agent running"
              />
            )}
            <span className="truncate">{project.name}</span>
          </h2>
          <p className="text-xs text-text-faint font-mono truncate" title={project.path}>
            {project.path}
          </p>
        </div>
        <span
          className={`px-2 py-0.5 text-xs rounded border whitespace-nowrap ${phaseColor(project.phase)}`}
        >
          {project.phase}
        </span>
      </div>

      {isRunning && (
        <div className="rounded border border-status-done/40 bg-status-done/10 p-2 text-xs space-y-1.5">
          {project.activeSessions.map((s) => (
            <ActiveSessionRow
              key={`${s.repoName}-${s.taskId}-${s.startedAt}`}
              session={s}
              controlPortAvailable={controlPortAvailable}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {project.inProgressTasks > 0 && (
          <span className={`px-2 py-0.5 rounded border ${statusColor('in_progress')}`}>
            {project.inProgressTasks} in progress
          </span>
        )}
        {project.readyTasks > 0 && (
          <span className={`px-2 py-0.5 rounded border ${statusColor('ready')}`}>
            {project.readyTasks} ready
          </span>
        )}
        <span className={`px-2 py-0.5 rounded border ${statusColor('done')}`}>
          {project.doneTasks} done
        </span>
      </div>

      {project.activeTasks.length > 0 && (
        <ul className="text-xs space-y-1">
          {project.activeTasks.slice(0, 3).map((t) => (
            <li key={t.id} className="flex items-center gap-2 min-w-0">
              <span className="text-text-faint font-mono shrink-0">{t.id}</span>
              <span className="truncate text-text-dim" title={t.title}>
                {t.title}
              </span>
            </li>
          ))}
          {project.activeTasks.length > 3 && (
            <li className="text-text-faint">+ {project.activeTasks.length - 3} more</li>
          )}
        </ul>
      )}

      {project.metrics && project.metrics.totalRuns > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-text-faint">24h / 7d</div>
              <div className="font-mono text-text">
                {project.metrics.runs24h}
                <span className="text-text-faint"> / </span>
                {project.metrics.runs7d}
              </div>
            </div>
            <div>
              <div className="text-text-faint">success</div>
              <div
                className={`font-mono ${
                  project.metrics.successRate >= 80
                    ? 'text-status-done'
                    : project.metrics.successRate >= 50
                      ? 'text-status-progress'
                      : 'text-status-error'
                }`}
              >
                {project.metrics.successRate}%
              </div>
            </div>
            <div>
              <div className="text-text-faint">avg</div>
              <div className="font-mono text-text">
                {formatDuration(project.metrics.avgDurationMs)}
              </div>
            </div>
          </div>
          {showTokens && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-text-faint">tokens in / out</div>
                <div className="font-mono text-text">
                  {formatTokens(project.metrics.tokens.inputTokens)}
                  <span className="text-text-faint"> / </span>
                  {formatTokens(project.metrics.tokens.outputTokens)}
                </div>
              </div>
              <div>
                <div className="text-text-faint">cache hit</div>
                <div
                  className={`font-mono ${
                    project.metrics.tokens.cacheHitRate >= 60
                      ? 'text-status-done'
                      : project.metrics.tokens.cacheHitRate >= 30
                        ? 'text-status-progress'
                        : 'text-text-dim'
                  }`}
                >
                  {project.metrics.tokens.cacheHitRate}%
                </div>
              </div>
              <div>
                <div className="text-text-faint">aborted</div>
                <div
                  className={`font-mono ${
                    project.metrics.abortedRuns > 0 ? 'text-status-blocked' : 'text-text-dim'
                  }`}
                >
                  {project.metrics.abortedRuns}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-text-dim border-t border-border pt-3 mt-auto">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-text-faint">last agent</span>
          <span className="font-mono text-text-dim truncate">{project.lastAgent}</span>
        </div>
        {project.quickContext && (
          <p className="line-clamp-2 text-text-dim leading-relaxed" title={project.quickContext}>
            {project.quickContext}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-text-faint">
          {project.lastUpdated ? <RelativeTime iso={project.lastUpdated} /> : 'no timestamp'}
        </span>
        {project.githubRepo && (
          <a
            href={`https://github.com/${project.githubRepo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline font-mono"
          >
            {project.githubRepo}
          </a>
        )}
      </div>
    </div>
  );
}

function ActiveSessionRow({
  session,
  controlPortAvailable,
}: {
  session: ActiveSession;
  controlPortAvailable: boolean;
}): React.ReactElement {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-status-done shrink-0">
          {session.taskId} {session.backend}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {session.startedAt && (
            <span className="text-text-faint">
              <RelativeTime iso={session.startedAt} />
            </span>
          )}
          <AbortButton
            repoName={session.repoName}
            taskId={session.taskId}
            disabled={!controlPortAvailable}
            disabledReason="runner is not exposing controlPort (is `aahp run` active?)"
          />
        </div>
      </div>
      {session.taskTitle && (
        <p className="text-text-dim truncate" title={session.taskTitle}>
          {session.taskTitle}
        </p>
      )}
      {session.lastLine && (
        <p className="font-mono text-text-faint truncate" title={session.lastLine}>
          &gt; {session.lastLine}
        </p>
      )}
    </div>
  );
}

function OrphanSessionsBanner({ sessions }: { sessions: ActiveSession[] }): React.ReactElement {
  return (
    <section className="mb-6 rounded-lg border border-status-progress/40 bg-status-progress/10 p-4">
      <h2 className="text-sm font-semibold text-status-progress mb-2">
        {sessions.length} active session{sessions.length === 1 ? '' : 's'} outside ROOT_DIR
      </h2>
      <ul className="space-y-1.5 text-xs">
        {sessions.map((s) => (
          <li key={`${s.repoName}-${s.taskId}-${s.startedAt}`}>
            <span className="font-mono text-status-progress">{s.repoName}</span>
            <span className="text-text-faint"> | </span>
            <span className="font-mono text-text-dim">{s.taskId}</span>
            <span className="text-text-faint"> | </span>
            <span className="text-text-dim">{s.taskTitle}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState({ rootDir, hasErrors }: { rootDir: string | null; hasErrors: boolean }) {
  if (!rootDir) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">ROOT_DIR not set</h2>
        <p className="text-text-dim text-sm">
          Set the <code className="text-accent font-mono">ROOT_DIR</code> environment variable to
          the directory the AAHP runner scans. Defaults to{' '}
          <code className="text-accent font-mono">~/Workspace</code>.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-bg-card p-8 text-center">
      <h2 className="text-lg font-semibold mb-2">No projects found</h2>
      <p className="text-text-dim text-sm">
        Scanned <code className="font-mono text-accent">{rootDir}</code> but found no{' '}
        <code className="font-mono">.ai/handoff/MANIFEST.json</code> files.
        {hasErrors && ' See errors below.'}
      </p>
    </div>
  );
}

export default async function Page(): Promise<React.ReactElement> {
  const result = await scanProjects();
  const totalReady = result.projects.reduce((s, p) => s + p.readyTasks, 0);
  const totalInProgress = result.projects.reduce((s, p) => s + p.inProgressTasks, 0);
  const totalDone = result.projects.reduce((s, p) => s + p.doneTasks, 0);

  return (
    <>
      <AutoRefresh />
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <header className="flex items-start justify-between gap-4 mb-8 pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold text-text">
              AAHP <span className="text-accent">Hub</span>
            </h1>
            <p className="text-sm text-text-dim mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <LiveIndicator />
              <span className="text-text-faint">|</span>
              <span>
                Last updated: <RelativeTime iso={result.scannedAt} />
              </span>
              {result.rootDir && (
                <>
                  <span className="text-text-faint">|</span>
                  <span className="text-text-faint">
                    {result.projects.length} project
                    {result.projects.length === 1 ? '' : 's'} in{' '}
                    <code className="font-mono">{result.rootDir}</code>
                  </span>
                </>
              )}
              {result.activeSessions.length > 0 && (
                <>
                  <span className="text-text-faint">|</span>
                  <span className="text-status-done">
                    {result.activeSessions.length} agent
                    {result.activeSessions.length === 1 ? '' : 's'} running
                  </span>
                </>
              )}
            </p>
          </div>
          <RefreshButton />
        </header>

        {result.orphanSessions.length > 0 && (
          <OrphanSessionsBanner sessions={result.orphanSessions} />
        )}

        {result.projects.length === 0 ? (
          <EmptyState rootDir={result.rootDir} hasErrors={result.errors.length > 0} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.projects.map((p) => (
              <ProjectCard
                key={p.path}
                project={p}
                controlPortAvailable={result.controlPort !== null}
              />
            ))}
          </div>
        )}

        {result.errors.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-status-error mb-2">
              Parse errors ({result.errors.length})
            </h2>
            <ul className="space-y-2 text-xs">
              {result.errors.map((e) => (
                <li
                  key={e.path}
                  className="rounded border border-status-error/40 bg-status-error/10 p-3"
                >
                  <p className="font-mono text-text-dim truncate">{e.path}</p>
                  <p className="text-status-error mt-1">{e.message}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-12 pt-6 border-t border-border space-y-2 text-xs text-text-faint">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{result.projects.length} projects</span>
              <span>{totalInProgress} in progress</span>
              <span>{totalReady} ready</span>
              <span>{totalDone} done</span>
            </div>
            <a
              href="https://github.com/homeofe/aahp-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              homeofe/aahp-hub
            </a>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {result.metricsAvailable ? (
              <>
                <span>
                  runner: <span className="text-text-dim">{result.totals.totalRuns} runs</span>
                </span>
                <span>
                  24h: <span className="text-text-dim">{result.totals.runs24h}</span>
                </span>
                <span>
                  7d: <span className="text-text-dim">{result.totals.runs7d}</span>
                </span>
                <span>
                  success: <span className="text-text-dim">{result.totals.successRate}%</span>
                </span>
                {result.totals.abortedRuns > 0 && (
                  <span>
                    aborted:{' '}
                    <span className="text-status-blocked">{result.totals.abortedRuns}</span>
                  </span>
                )}
                {tokensRecorded(result.totals.tokens) && (
                  <span>
                    tokens:{' '}
                    <span className="text-text-dim">
                      {formatTokens(result.totals.tokens.inputTokens)} in /{' '}
                      {formatTokens(result.totals.tokens.outputTokens)} out
                    </span>{' '}
                    <span className="text-text-faint">
                      ({result.totals.tokens.cacheHitRate}% cache)
                    </span>
                  </span>
                )}
                <span className="text-text-faint/70 font-mono">{result.metricsFile}</span>
              </>
            ) : result.metricsError ? (
              <span className="text-status-error">
                metrics: {result.metricsError}
              </span>
            ) : (
              <span>
                metrics: no <span className="font-mono">{result.metricsFile}</span> yet
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {result.sessionsError ? (
              <span className="text-status-error">sessions: {result.sessionsError}</span>
            ) : result.sessionsAvailable ? (
              <span>
                sessions:{' '}
                <span className="text-text-dim">
                  {result.activeSessions.length} active
                </span>
                <span className="text-text-faint/70 font-mono"> {result.sessionsFile}</span>
              </span>
            ) : (
              <span>
                sessions: no <span className="font-mono">{result.sessionsFile}</span> yet
              </span>
            )}
            <span>
              control:{' '}
              {result.controlPort ? (
                <span className="text-status-done font-mono">:{result.controlPort}</span>
              ) : (
                <span className="text-text-faint">not available</span>
              )}
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}
