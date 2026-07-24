import { scanProjects, type ProjectSummary } from '@/lib/manifest';
import { formatTokens, type TokenStats } from '@/lib/metrics';
import type { ActiveSession } from '@/lib/sessions';
import { computeHealth, type HealthScore } from '@/lib/health';
import { AutoRefresh, LiveIndicator } from './auto-refresh';
import { HeaderControls } from './header-controls';
import { MorningBriefing } from './morning-briefing';
import { ProjectFilter } from './project-filter';
import { RunButton } from './run-button';
import { RelativeTime } from './timestamp';
import { redactHome } from '@/lib/redact';
import { loadToolingStatus } from '@/lib/tooling';
import { ToolingPanel } from './tooling-panel';
import { PhaseChart } from './phase-chart';
import { AtRiskWidget } from './at-risk-widget';
import { ActivityFeed, type ActivityEvent } from './activity-feed';
import { SystemStatus } from './system-status';
import { ProjectOverviewCard } from './project-overview-card';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ── Helpers ────────────────────────────────────────────────── */

function tokensRecorded(stats: TokenStats): boolean {
  return (
    stats.recordedRuns > 0 &&
    (stats.inputTokens > 0 || stats.outputTokens > 0 || stats.cacheReadTokens > 0)
  );
}

function ProjectCard({
  project,
  health,
}: {
  project: ProjectSummary;
  health: HealthScore;
}): React.ReactElement {
  return <ProjectOverviewCard project={project} health={health} />;
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

/* ── Insights Sidebar ────────────────────────────────────────── */

function InsightsPanel({
  projects,
  healthMap,
  recentEvents,
}: {
  projects: ProjectSummary[];
  healthMap: Map<string, HealthScore>;
  recentEvents: ActivityEvent[];
}): React.ReactElement {
  const phaseMap = new Map<string, number>();
  for (const p of projects) {
    phaseMap.set(p.phase, (phaseMap.get(p.phase) ?? 0) + 1);
  }
  const phases = [...phaseMap.entries()].map(([phase, count]) => ({ phase, count }));

  // At-risk projects (health < 60)
  const atRisk = projects
    .map((p) => ({
      id: p.id,
      name: p.name,
      health: healthMap.get(p.path) ?? { score: 0, grade: 'F' as const, factors: [] },
      lastUpdated: p.lastUpdated,
      readyTasks: p.readyTasks,
      githubRepo: p.githubRepo,
    }))
    .filter((p) => p.health.score < 60)
    .sort((a, b) => a.health.score - b.health.score);

  return (
    <aside className="space-y-3">
      <div className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-3.5">
        <div className="font-mono text-[11px] font-bold text-sec uppercase tracking-wider mb-2">
          {'\u25C6'} PHASE DISTRIBUTION
        </div>
        <PhaseChart phases={phases} />
      </div>

      {/* At-risk widget */}
      <AtRiskWidget projects={atRisk} />

      {/* Activity feed */}
      <ActivityFeed events={recentEvents} />
    </aside>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default async function Page(): Promise<React.ReactElement> {
  const result = await scanProjects();
  const tooling = await loadToolingStatus();
  const totalReady = result.projects.reduce((s, p) => s + p.readyTasks, 0);
  const totalInProgress = result.projects.reduce((s, p) => s + p.inProgressTasks, 0);
  const totalDone = result.projects.reduce((s, p) => s + p.doneTasks, 0);

  // Compute health scores
  const healthMap = new Map<string, HealthScore>();
  for (const p of result.projects) {
    healthMap.set(p.path, computeHealth(p));
  }

  // Collect recent events from all project metrics
  const recentEvents: ActivityEvent[] = [];
  for (const p of result.projects) {
    if (p.metrics?.recentEvents) {
      for (const e of p.metrics.recentEvents) {
        recentEvents.push(e);
      }
    }
  }
  recentEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const topEvents = recentEvents.slice(0, 15);

  const topReadyTasks: Array<{
    repoName: string;
    taskId: string;
    title: string;
  }> = [];

  for (const p of result.projects) {
    for (const t of p.activeTasks) {
      topReadyTasks.push({
        repoName: p.name,
        taskId: t.id,
        title: t.title,
      });
    }
  }

  return (
    <>
      <AutoRefresh />
      <main className="flex-1 w-full mx-auto px-6 py-5 2xl:px-10 space-y-4">
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
              <span className="text-dim">·</span>
              <kbd className="text-[9px] font-mono text-dim bg-[var(--c2)] border border-br rounded px-1 py-0.5">Ctrl+K</kbd>
              <span className="text-dim text-[9px]">search</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RunningCounter count={result.activeSessions.length} />
            <HeaderControls />
          </div>
        </header>

        <details className="group rounded-[var(--r)] border border-br bg-[var(--c1)]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-[var(--fs-xs)] text-sec hover:text-cy">
            <span>Workspace intelligence and tooling</span>
            <span className="transition group-open:rotate-180">{'\u25BE'}</span>
          </summary>
          <div className="space-y-4 border-t border-br p-4">
            <MorningBriefing
              scannedAt={result.scannedAt}
              totalProjects={result.projects.length}
              totalReady={totalReady}
              runningCount={result.activeSessions.length}
              runnerAvailable={result.runner.available}
              controlPort={result.controlPort}
              metricsFile={result.metricsFile}
              totals={result.totals}
              topReadyTasks={topReadyTasks}
            />

            <ToolingPanel tooling={tooling} />

          </div>
        </details>

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
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_18rem] gap-4">
            {/* Main project grid */}
            <div className="flex-1 min-w-0">
              <div
                id="proj-grid"
                className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3"
              >
                {result.projects.map((p) => (
                  <ProjectCard
                    key={p.path}
                    project={p}
                    health={healthMap.get(p.path) ?? { score: 0, grade: 'F', factors: [] }}
                  />
                ))}
              </div>
            <div
              id="project-filter-empty"
              hidden
              className="rounded-[var(--r)] border border-dashed border-br bg-[var(--c1)] p-8 text-center font-mono text-[var(--fs-sm)] text-dim"
            >
              No projects match the current filters.
            </div>
            </div>

            {/* Insights stack below the grid, then beside it on wide screens. */}
            <div className="min-w-0 [&>aside]:grid [&>aside]:grid-cols-1 lg:[&>aside]:grid-cols-3 2xl:[&>aside]:grid-cols-1">
              <InsightsPanel
                projects={result.projects}
                healthMap={healthMap}
                recentEvents={topEvents}
              />
            </div>
          </div>
        )}

        {/* Parse errors section - improved with preview */}
        {result.errors.length > 0 && (
          <section className="mt-6">
            <h2 className="akido-section-title text-er mb-2">
              {'\u26A0'} Manifest parse errors ({result.errors.length})
            </h2>
            <p className="text-[var(--fs-xs)] text-dim mb-3">
              These projects have malformed or unreadable MANIFEST.json files.
              Fix the JSON syntax errors to include them in the dashboard.
            </p>
            <ul className="space-y-2 text-[var(--fs-xs)]">
              {result.errors.map((e, idx) => (
                <li
                  key={`${e.path}-${idx}`}
                  className="rounded-[var(--r)] border border-[rgba(255,64,96,0.4)] bg-[var(--er-soft)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sec truncate flex-1">{redactHome(e.path)}</p>
                    <span className="akido-chip text-er text-[9px]">parse error</span>
                  </div>
                  <p className="text-er mt-1 font-mono text-[var(--fs-xs)]">{e.message}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* System status footer (collapsible) */}
        <SystemStatus
          projectCount={result.projects.length}
          stubCount={result.stubs.length}
          totalInProgress={totalInProgress}
          totalReady={totalReady}
          totalDone={totalDone}
          metricsAvailable={result.metricsAvailable}
          metricsError={result.metricsError}
          metricsFile={redactHome(result.metricsFile)}
          sessionsAvailable={result.sessionsAvailable}
          sessionsError={result.sessionsError}
          sessionsFile={redactHome(result.sessionsFile)}
          activeSessionCount={result.activeSessions.length}
          controlPort={result.controlPort}
          totalRuns={result.totals.totalRuns}
          runs24h={result.totals.runs24h}
          runs7d={result.totals.runs7d}
          successRate={result.totals.successRate}
          abortedRuns={result.totals.abortedRuns}
          tokensSummary={
            tokensRecorded(result.totals.tokens)
              ? `${formatTokens(result.totals.tokens.inputTokens)} in / ${formatTokens(result.totals.tokens.outputTokens)} out (${result.totals.tokens.cacheHitRate}% cache)`
              : null
          }
          cacheSummary={null}
        />
      </main>
    </>
  );
}
