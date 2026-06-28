import { scanProjects, type ProjectSummary } from '@/lib/manifest';
import { formatDuration, formatTokens, type TokenStats } from '@/lib/metrics';
import type { ActiveSession } from '@/lib/sessions';
import { AbortButton } from './abort-button';
import { AutoRefresh, LiveIndicator, RefreshButton } from './auto-refresh';
import { ProjectFilter } from './project-filter';
import { RunButton } from './run-button';
import { RelativeTime } from './timestamp';
import { redactHome } from '@/lib/redact';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function tokensRecorded(stats: TokenStats): boolean {
  return (
    stats.recordedRuns > 0 &&
    (stats.inputTokens > 0 || stats.outputTokens > 0 || stats.cacheReadTokens > 0)
  );
}

function cardStateClass(p: ProjectSummary): string {
  if (p.activeSessions.length > 0) return 'is-running';
  if (p.inProgressTasks > 0) return 'is-active-tasks';
  if (p.readyTasks > 0) return 'is-active-tasks';
  if (p.doneTasks > 0 && p.totalTasks === p.doneTasks) return 'is-clean';
  return '';
}

function cardFilterAttr(p: ProjectSummary): string {
  if (p.activeSessions.length > 0) return 'running';
  if (p.inProgressTasks > 0 || p.readyTasks > 0) return 'has-tasks';
  return 'idle';
}

function dotColor(p: ProjectSummary): string {
  if (p.activeSessions.length > 0) return 'text-ok';
  if (p.readyTasks > 0 || p.inProgressTasks > 0) return 'text-warn';
  if (p.doneTasks > 0) return 'text-cy';
  return 'text-dim';
}

function ProjectCard({
  project,
  controlPortAvailable,
  runnerAvailable,
}: {
  project: ProjectSummary;
  controlPortAvailable: boolean;
  runnerAvailable: boolean;
}): React.ReactElement {
  const isRunning = project.activeSessions.length > 0;
  const showTokens = project.metrics ? tokensRecorded(project.metrics.tokens) : false;
  const startDisabled =
    !runnerAvailable || isRunning || project.readyTasks + project.inProgressTasks === 0;
  const startReason = !runnerAvailable
    ? 'aahp not on PATH'
    : isRunning
      ? 'agent already running'
      : project.readyTasks + project.inProgressTasks === 0
        ? 'no ready or in_progress tasks'
        : undefined;
  const ghUrl = project.githubRepo ? `https://github.com/${project.githubRepo}` : null;
  const lastLine =
    project.activeSessions[0]?.lastLine ?? project.quickContext.split(/[\.\n]/)[0]?.trim() ?? '';

  return (
    <div
      className={`akido-card ${cardStateClass(project)}`}
      data-name={project.name}
      data-filter={cardFilterAttr(project)}
    >
      {/* Header: dot + name + phase chip */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] ${dotColor(project)} shrink-0`} aria-hidden>
          {isRunning ? '◉' : '●'}
        </span>
        <span
          className="font-mono text-[var(--fs-base)] font-bold text-tx flex-1 truncate"
          title={project.name}
        >
          {project.name}
        </span>
        <span className="akido-chip">{project.phase}</span>
      </div>

      {/* Commit-style row: agent + quick context first line */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[var(--fs-xs)] text-cy bg-[var(--cy-soft)] border border-[rgba(48,172,236,0.08)] rounded-[var(--r)] px-1.5 opacity-80 shrink-0">
          {project.lastAgent}
        </span>
        <span
          className="font-mono text-[var(--fs-sm)] text-sec truncate flex-1"
          title={project.quickContext}
        >
          {lastLine || '-'}
        </span>
      </div>

      {/* Live session row when running */}
      {isRunning && project.activeSessions[0] && (
        <ActiveSessionRow
          session={project.activeSessions[0]}
          controlPortAvailable={controlPortAvailable}
        />
      )}

      {/* Meta row: time + task badges */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-br">
        <span className="font-mono text-[var(--fs-xs)] text-dim">
          {project.lastUpdated ? <RelativeTime iso={project.lastUpdated} /> : 'no timestamp'}
        </span>
        <div className="flex gap-1 items-center">
          {project.inProgressTasks > 0 && (
            <span className="font-mono text-[var(--fs-xs)] font-bold px-1.5 rounded-[var(--r)] bg-[var(--warn-soft)] text-warn border border-[rgba(255,187,0,0.3)]">
              ~{project.inProgressTasks}
            </span>
          )}
          {project.readyTasks > 0 && (
            <span className="font-mono text-[var(--fs-xs)] font-bold px-1.5 rounded-[var(--r)] bg-[var(--cy-soft)] text-cy border border-[rgba(48,172,236,0.3)]">
              {project.readyTasks} ready
            </span>
          )}
          <span className="font-mono text-[var(--fs-xs)] font-bold px-1.5 rounded-[var(--r)] bg-[var(--ok-soft)] text-ok border border-[rgba(0,232,122,0.3)]">
            {project.doneTasks}
          </span>
        </div>
      </div>

      {/* Active task list (compact) */}
      {project.activeTasks.length > 0 && (
        <ul className="text-[var(--fs-xs)] space-y-0.5">
          {project.activeTasks.slice(0, 3).map((t) => (
            <li key={t.id} className="flex items-center gap-2 min-w-0">
              <span className="text-dim font-mono shrink-0">{t.id}</span>
              <span className="truncate text-sec" title={t.title}>
                {t.title}
              </span>
            </li>
          ))}
          {project.activeTasks.length > 3 && (
            <li className="text-dim font-mono">+ {project.activeTasks.length - 3} more</li>
          )}
        </ul>
      )}

      {/* Metrics row: 24h/7d, success, avg duration */}
      <div className="grid grid-cols-3 gap-2 text-[var(--fs-xs)]">
        <Stat
          label="24h / 7d"
          value={
            project.metrics
              ? `${project.metrics.runs24h} / ${project.metrics.runs7d}`
              : null
          }
        />
        <Stat
          label="success"
          value={project.metrics ? `${project.metrics.successRate}%` : null}
          tone={
            project.metrics
              ? project.metrics.successRate >= 80
                ? 'ok'
                : project.metrics.successRate >= 50
                  ? 'warn'
                  : 'er'
              : 'neutral'
          }
        />
        <Stat
          label="avg"
          value={project.metrics ? formatDuration(project.metrics.avgDurationMs) : null}
        />
      </div>

      {/* Token row */}
      <div className="grid grid-cols-3 gap-2 text-[var(--fs-xs)]">
        <Stat
          label="tokens i/o"
          value={
            showTokens
              ? `${formatTokens(project.metrics!.tokens.inputTokens)} / ${formatTokens(project.metrics!.tokens.outputTokens)}`
              : null
          }
        />
        <Stat
          label="cache"
          value={showTokens ? `${project.metrics!.tokens.cacheHitRate}%` : null}
          tone={
            showTokens
              ? project.metrics!.tokens.cacheHitRate >= 60
                ? 'ok'
                : project.metrics!.tokens.cacheHitRate >= 30
                  ? 'warn'
                  : 'neutral'
              : 'neutral'
          }
        />
        <Stat
          label="aborted"
          value={project.metrics ? String(project.metrics.abortedRuns) : null}
          tone={project.metrics && project.metrics.abortedRuns > 0 ? 'er' : 'neutral'}
        />
      </div>

      {/* Action button row */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-br">
        {ghUrl ? (
          <a className="akido-link-btn" href={ghUrl} target="_blank" rel="noopener noreferrer">
            ↗ Repo
          </a>
        ) : (
          <span className="akido-link-btn is-disabled" title="no github_repo in MANIFEST">
            ↗ Repo
          </span>
        )}
        {ghUrl && (
          <>
            <a
              className="akido-link-btn"
              href={`${ghUrl}/issues`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Issues
            </a>
            <a
              className="akido-link-btn"
              href={`${ghUrl}/pulls`}
              target="_blank"
              rel="noopener noreferrer"
            >
              PRs
            </a>
          </>
        )}
        <RunButton
          project={project.name}
          label="▶ start"
          variant="primary"
          disabled={startDisabled}
          disabledReason={startReason}
          confirmMessage={`Start aahp run on ${project.name}?`}
        />
        {isRunning && project.activeSessions[0] && (
          <AbortButton
            repoName={project.activeSessions[0].repoName}
            taskId={project.activeSessions[0].taskId}
            disabled={!controlPortAvailable}
            disabledReason="runner controlPort missing"
          />
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
    <div className="rounded-[var(--r)] border border-[rgba(0,232,122,0.3)] bg-[var(--ok-soft)] px-2 py-1.5 text-[var(--fs-xs)] space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-ok shrink-0">
          {session.taskId} · {session.backend}
        </span>
        {session.startedAt && (
          <span className="text-dim">
            <RelativeTime iso={session.startedAt} />
          </span>
        )}
      </div>
      {session.taskTitle && (
        <p className="text-sec truncate" title={session.taskTitle}>
          {session.taskTitle}
        </p>
      )}
      {session.lastLine && (
        <p className="font-mono text-dim truncate" title={session.lastLine}>
          &gt; {session.lastLine}
        </p>
      )}
      {!controlPortAvailable && (
        <p className="text-dim italic">controlPort missing - cannot abort</p>
      )}
    </div>
  );
}

type StatTone = 'ok' | 'warn' | 'er' | 'neutral';

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | null;
  tone?: StatTone;
}): React.ReactElement {
  const toneClass =
    value === null
      ? 'text-dim'
      : tone === 'ok'
        ? 'text-ok'
        : tone === 'warn'
          ? 'text-warn'
          : tone === 'er'
            ? 'text-er'
            : 'text-tx';
  return (
    <div>
      <div className="text-dim text-[var(--fs-micro)] uppercase tracking-wider">{label}</div>
      <div className={`font-mono ${toneClass}`}>{value ?? '-'}</div>
    </div>
  );
}

function ControlCenter({
  runner,
  controlPort,
  runningCount,
  totalReady,
  totalProjects,
}: {
  runner: import('@/lib/manifest').ScanResult['runner'];
  controlPort: number | null;
  runningCount: number;
  totalReady: number;
  totalProjects: number;
}): React.ReactElement {
  const runnerActive = runner.available && controlPort !== null;
  const noReady = totalReady === 0;
  const allDisabled = !runner.available || runnerActive || noReady;
  const allReason = !runner.available
    ? 'aahp binary not on PATH'
    : runnerActive
      ? `aahp run already active (port :${controlPort})`
      : noReady
        ? 'no ready tasks across the workspace'
        : undefined;
  const runnerSilentlyActive = runnerActive && runningCount === 0;

  const dotClass = runner.available
    ? runningCount > 0
      ? 'bg-ok shadow-[0_0_8px_rgba(0,232,122,0.6)] animate-pulse'
      : 'bg-ok/70'
    : 'bg-er';

  const stateLabel = !runner.available
    ? 'aahp not found'
    : runnerActive
      ? `:${controlPort} run active`
      : 'idle';

  return (
    <section className="mb-4 rounded-[var(--r)] border border-br bg-c1 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} aria-hidden />
        <div className="leading-tight">
          <div className="text-[var(--fs-sm)] font-semibold text-tx">
            aahp {runner.version ?? 'not found'}
          </div>
          <div className="text-[var(--fs-xs)] text-dim font-mono">{stateLabel}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--fs-xs)]">
        <Counter label="projects" value={totalProjects} tone="neutral" />
        <Counter label="live agents" value={runningCount} tone={runningCount > 0 ? 'ok' : 'neutral'} />
        <Counter label="ready" value={totalReady} tone={totalReady > 0 ? 'cy' : 'neutral'} />
      </div>

      <div className="flex flex-wrap gap-2 ml-auto">
        <RunButton
          all
          label="▶ run all ready"
          variant="primary"
          disabled={allDisabled}
          disabledReason={allReason}
          confirmMessage={`Start aahp run --all? Will spawn agents on every project with ready tasks (${totalReady}).`}
        />
        <RunButton
          all
          dryRun
          label="dry run"
          disabled={!runner.available}
          disabledReason={runner.available ? undefined : 'aahp binary not on PATH'}
        />
      </div>

      {!runner.available && (
        <p className="basis-full text-[var(--fs-xs)] text-dim">
          install with{' '}
          <code className="font-mono text-sec">npm install -g @elvatis_com/aahp-runner</code>
          {runner.error && (
            <span className="font-mono ml-2 text-dim/70" title={runner.error}>
              (details on hover)
            </span>
          )}
        </p>
      )}

      {runnerSilentlyActive && (
        <p
          className="basis-full text-[var(--fs-xs)] text-warn"
          title="aahp run is executing but has not published its agent list to sessions.json. Tracked in homeofe/aahp-runner#31."
        >
          aahp run is active on :{controlPort} but live agent list is not published yet
          (homeofe/aahp-runner#31)
        </p>
      )}
    </section>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'cy' | 'neutral';
}): React.ReactElement {
  const valueClass =
    value === 0
      ? 'text-dim'
      : tone === 'ok'
        ? 'text-ok'
        : tone === 'cy'
          ? 'text-cy'
          : 'text-tx';
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-dim">{label}</span>
      <span className={`font-mono ${valueClass}`}>{value}</span>
    </span>
  );
}

function RunningCounter({ count }: { count: number }): React.ReactElement {
  const isLive = count > 0;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-[var(--r)] border ${
        isLive ? 'border-[rgba(0,232,122,0.5)] bg-[var(--ok-soft)]' : 'border-br bg-c2'
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          isLive
            ? 'bg-ok shadow-[0_0_10px_rgba(0,232,122,0.7)] animate-pulse'
            : 'bg-dim'
        }`}
        aria-hidden
      />
      <div className="leading-tight">
        <div
          className={`font-mono text-2xl font-semibold ${isLive ? 'text-ok' : 'text-sec'}`}
        >
          {count}
        </div>
        <div className="text-[var(--fs-micro)] uppercase tracking-wider text-dim">
          {count === 1 ? 'agent running' : 'agents running'}
        </div>
      </div>
    </div>
  );
}

function OrphanSessionsBanner({
  sessions,
}: {
  sessions: ActiveSession[];
}): React.ReactElement {
  return (
    <section className="mb-4 rounded-[var(--r)] border border-[rgba(255,187,0,0.4)] bg-[var(--warn-soft)] px-4 py-3">
      <h2 className="text-[var(--fs-sm)] font-semibold text-warn mb-1.5">
        {sessions.length} active session{sessions.length === 1 ? '' : 's'} outside ROOT_DIR
      </h2>
      <ul className="space-y-1 text-[var(--fs-xs)] font-mono">
        {sessions.map((s) => (
          <li key={`${s.repoName}-${s.taskId}-${s.startedAt}`}>
            <span className="text-warn">{s.repoName}</span>
            <span className="text-dim"> · </span>
            <span className="text-sec">{s.taskId}</span>
            <span className="text-dim"> · </span>
            <span className="text-sec">{s.taskTitle}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState({
  rootDir,
  hasErrors,
}: {
  rootDir: string | null;
  hasErrors: boolean;
}): React.ReactElement {
  if (!rootDir) {
    return (
      <div className="rounded-[var(--r)] border border-br bg-c1 p-8 text-center">
        <h2 className="text-[var(--fs-lg)] font-semibold text-tx mb-2">
          ROOT_DIR not set
        </h2>
        <p className="text-dim text-[var(--fs-sm)]">
          Set the <code className="text-cy font-mono">ROOT_DIR</code> environment variable.
          Defaults to <code className="text-cy font-mono">~/Workspace</code>.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--r)] border border-br bg-c1 p-8 text-center">
      <h2 className="text-[var(--fs-lg)] font-semibold text-tx mb-2">No projects found</h2>
      <p className="text-dim text-[var(--fs-sm)]">
        Scanned <code className="font-mono text-cy">{redactHome(rootDir)}</code> but found no{' '}
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
      <main className="flex-1 w-full mx-auto px-6 py-5 2xl:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-br">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-tx" style={{ fontFamily: 'var(--font-mono)' }}>
              <span className="text-cy">AAHP</span> Hub
            </h1>
            <p className="text-[var(--fs-xs)] text-dim mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <LiveIndicator />
              <span className="text-dim">·</span>
              <span>
                updated <RelativeTime iso={result.scannedAt} />
              </span>
              {result.rootDir && (
                <>
                  <span className="text-dim">·</span>
                  <span className="text-dim font-mono">{redactHome(result.rootDir)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RunningCounter count={result.activeSessions.length} />
            <RefreshButton />
          </div>
        </header>

        <ControlCenter
          runner={result.runner}
          controlPort={result.controlPort}
          runningCount={result.activeSessions.length}
          totalReady={totalReady}
          totalProjects={result.projects.length}
        />

        {result.orphanSessions.length > 0 && (
          <OrphanSessionsBanner sessions={result.orphanSessions} />
        )}

        {result.projects.length > 0 && <ProjectFilter />}

        {result.projects.length === 0 ? (
          <EmptyState rootDir={result.rootDir} hasErrors={result.errors.length > 0} />
        ) : (
          <div
            id="proj-grid"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
          >
            {result.projects.map((p) => (
              <ProjectCard
                key={p.path}
                project={p}
                controlPortAvailable={result.controlPort !== null}
                runnerAvailable={result.runner.available}
              />
            ))}
          </div>
        )}

        {result.errors.length > 0 && (
          <section className="mt-6">
            <h2 className="akido-section-title text-er mb-2">
              Parse errors ({result.errors.length})
            </h2>
            <ul className="space-y-2 text-[var(--fs-xs)]">
              {result.errors.map((e) => (
                <li
                  key={e.path}
                  className="rounded-[var(--r)] border border-[rgba(255,64,96,0.4)] bg-[var(--er-soft)] p-3"
                >
                  <p className="font-mono text-sec truncate">{redactHome(e.path)}</p>
                  <p className="text-er mt-1">{e.message}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 pt-4 border-t border-br space-y-2 text-[var(--fs-xs)] text-dim">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{result.projects.length} projects</span>
              {result.stubs.length > 0 && (
                <span title={result.stubs.map((s) => redactHome(s.path)).join('\n')}>
                  {result.stubs.length} stub{result.stubs.length === 1 ? '' : 's'} hidden
                </span>
              )}
              <span title="Tasks marked in_progress in MANIFEST.json (manifest state, not live agents)">
                {totalInProgress} in_progress (manifest)
              </span>
              <span>{totalReady} ready</span>
              <span>{totalDone} done</span>
            </div>
            <a
              href="https://github.com/homeofe/aahp-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cy font-mono"
            >
              homeofe/aahp-hub
            </a>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {result.metricsAvailable ? (
              <>
                <span>
                  runner: <span className="text-sec">{result.totals.totalRuns} runs</span>
                </span>
                <span>
                  24h: <span className="text-sec">{result.totals.runs24h}</span>
                </span>
                <span>
                  7d: <span className="text-sec">{result.totals.runs7d}</span>
                </span>
                <span>
                  success: <span className="text-sec">{result.totals.successRate}%</span>
                </span>
                {result.totals.abortedRuns > 0 && (
                  <span>
                    aborted: <span className="text-er">{result.totals.abortedRuns}</span>
                  </span>
                )}
                {tokensRecorded(result.totals.tokens) && (
                  <span>
                    tokens:{' '}
                    <span className="text-sec">
                      {formatTokens(result.totals.tokens.inputTokens)} in /{' '}
                      {formatTokens(result.totals.tokens.outputTokens)} out
                    </span>{' '}
                    <span className="text-dim">
                      ({result.totals.tokens.cacheHitRate}% cache)
                    </span>
                  </span>
                )}
                <span className="text-dim font-mono">{redactHome(result.metricsFile)}</span>
              </>
            ) : result.metricsError ? (
              <span className="text-er">metrics: {result.metricsError}</span>
            ) : (
              <span>
                metrics: no <span className="font-mono">{redactHome(result.metricsFile)}</span> yet
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {result.sessionsError ? (
              <span className="text-er">sessions: {result.sessionsError}</span>
            ) : result.sessionsAvailable ? (
              <span>
                sessions: <span className="text-sec">{result.activeSessions.length} active</span>
                <span className="text-dim font-mono"> {redactHome(result.sessionsFile)}</span>
              </span>
            ) : (
              <span>
                sessions: no <span className="font-mono">{redactHome(result.sessionsFile)}</span> yet
              </span>
            )}
            <span>
              control:{' '}
              {result.controlPort ? (
                <span className="text-ok font-mono">:{result.controlPort}</span>
              ) : (
                <span className="text-dim">not available</span>
              )}
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}
