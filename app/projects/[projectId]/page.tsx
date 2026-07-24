import Link from 'next/link';
import { notFound } from 'next/navigation';
import { scanProjects, type ProjectSummary } from '@/lib/manifest';
import { computeHealth } from '@/lib/health';
import { formatDuration, formatTokens } from '@/lib/metrics';
import { githubProjectLinks } from '@/lib/project-links';
import { redactHome } from '@/lib/redact';
import { AbortButton } from '../../abort-button';
import { AutoRefresh, LiveIndicator } from '../../auto-refresh';
import { HealthBadge } from '../../health-badge';
import { RelativeTime } from '../../timestamp';
import { RunButton } from '../../run-button';
import { Sparkline } from '../../sparkline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function progressPercent(project: ProjectSummary): number {
  return project.totalTasks > 0 ? Math.round((project.doneTasks / project.totalTasks) * 100) : 0;
}

function toneForStatus(status: string): string {
  if (status === 'done') return 'bg-[var(--ok-soft)] text-ok border-[rgba(14,169,125,0.25)]';
  if (status === 'in_progress') return 'bg-[var(--warn-soft)] text-warn border-[rgba(255,183,3,0.25)]';
  if (status === 'ready') return 'bg-[var(--cy-soft)] text-cy border-[rgba(0,180,216,0.25)]';
  if (status === 'blocked') return 'bg-[var(--er-soft)] text-er border-[rgba(255,77,109,0.25)]';
  return 'bg-[var(--c2)] text-dim border-br';
}

function MetricCard({ label, value, note, tone = 'text-tx' }: { label: string; value: string; note: string; tone?: string }): React.ReactElement {
  return (
    <div className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-4">
      <div className="font-mono text-[9px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-[var(--fs-xs)] text-dim">{note}</div>
    </div>
  );
}

function Section({ id, title, eyebrow, children }: { id: string; title: string; eyebrow: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section id={id} className="scroll-mt-5 rounded-[var(--r-lg)] border border-br bg-[rgba(14,23,56,0.78)] p-5">
      <div className="mb-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cy">{eyebrow}</div>
        <h2 className="mt-1 text-base font-semibold text-tx">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default async function ProjectPage({ params }: PageProps<'/projects/[projectId]'>): Promise<React.ReactElement> {
  const { projectId } = await params;
  const scan = await scanProjects();
  const project = scan.projects.find((item) => item.id === projectId);
  if (!project) notFound();

  const health = computeHealth(project);
  const github = githubProjectLinks(project.githubRepo);
  const metrics = project.metrics;
  const progress = progressPercent(project);
  const isRunning = project.activeSessions.length > 0;
  const canRun = scan.runner.available && !isRunning && project.readyTasks + project.inProgressTasks > 0;
  const runDisabledReason = !scan.runner.available
    ? 'aahp is not available on PATH'
    : isRunning
      ? 'An agent is already running for this project'
      : 'No ready or in-progress tasks';

  return (
    <>
      <AutoRefresh />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-5 py-5 2xl:px-9">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-[var(--fs-xs)] text-dim">
            <Link href="/" className="hover:text-cy">Fleet overview</Link>
            <span>/</span>
            <span className="text-sec">{project.name}</span>
          </div>
          <LiveIndicator />
        </div>

        <header className="rounded-[var(--r-lg)] border border-[rgba(0,180,216,0.28)] bg-[linear-gradient(135deg,rgba(14,23,56,0.96),rgba(9,17,43,0.9))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <HealthBadge score={health.score} grade={health.grade} size={52} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words font-mono text-2xl font-bold text-tx">{project.name}</h1>
                  <span className="akido-chip">{project.phase}</span>
                  <span className={`akido-pill ${isRunning ? 'text-ok border-[rgba(14,169,125,0.4)]' : ''}`}>
                    {isRunning ? 'running' : project.inProgressTasks > 0 ? 'in progress' : project.readyTasks > 0 ? 'ready' : 'idle'}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-sec">
                  {project.quickContext || 'No project context has been recorded yet.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-dim">
                  <span>agent: <span className="text-sec">{project.lastAgent}</span></span>
                  <span>updated: <span className="text-sec">{project.lastUpdated ? <RelativeTime iso={project.lastUpdated} /> : 'never'}</span></span>
                  <span>path: <span className="text-sec">{redactHome(project.path)}</span></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {github && (
                <>
                  <a className="akido-link-btn is-primary" href={github.repository} target="_blank" rel="noopener noreferrer">Repository {'\u2197'}</a>
                  <a className="akido-link-btn" href={github.issues} target="_blank" rel="noopener noreferrer">Issues</a>
                  <a className="akido-link-btn" href={github.pulls} target="_blank" rel="noopener noreferrer">Pull requests</a>
                  <a className="akido-link-btn" href={github.actions} target="_blank" rel="noopener noreferrer">Actions</a>
                </>
              )}
              <RunButton project={project.name} label={'\u25B6 Start run'} variant="primary" disabled={!canRun} disabledReason={runDisabledReason} />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--c2)]">
              <div className="h-full rounded-full bg-cy" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-mono text-[var(--fs-xs)] text-sec">{progress}% complete</span>
          </div>
        </header>

        <nav className="sticky top-0 z-20 my-4 flex gap-1 overflow-x-auto rounded-[var(--r)] border border-br bg-[rgba(7,12,30,0.92)] p-1.5 backdrop-blur-md" aria-label="Project sections">
          {[
            ['overview', 'Overview'], ['tasks', 'Tasks'], ['activity', 'Activity'],
            ['health', 'Health'], ['context', 'Context'], ['controls', 'Controls'],
          ].map(([href, label]) => (
            <a key={href} href={`#${href}`} className="shrink-0 rounded px-3 py-1.5 font-mono text-[var(--fs-xs)] text-sec hover:bg-[var(--c2)] hover:text-cy">{label}</a>
          ))}
        </nav>

        <div id="overview" className="scroll-mt-20 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Tasks" value={`${project.doneTasks}/${project.totalTasks}`} note={`${project.readyTasks} ready / ${project.inProgressTasks} active`} tone="text-cy" />
          <MetricCard label="Health" value={`${health.score}/100`} note={`Grade ${health.grade}`} tone={health.score >= 75 ? 'text-ok' : health.score >= 50 ? 'text-warn' : 'text-er'} />
          <MetricCard label="Success" value={metrics ? `${metrics.successRate}%` : '-'} note={metrics ? `${metrics.totalRuns} recorded runs` : 'No runner metrics'} tone={metrics && metrics.successRate >= 80 ? 'text-ok' : 'text-warn'} />
          <MetricCard label="Average run" value={metrics ? formatDuration(metrics.avgDurationMs) : '-'} note={metrics ? `${metrics.runs7d} runs in 7 days` : 'No runner metrics'} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.8fr)]">
          <div className="space-y-4">
            <Section id="tasks" eyebrow="Execution queue" title={`Tasks (${project.tasks.length})`}>
              {project.tasks.length === 0 ? (
                <p className="text-sm text-dim">No tasks are recorded in this manifest.</p>
              ) : (
                <div className="overflow-hidden rounded-[var(--r)] border border-br">
                  {project.tasks.map((task) => (
                    <div key={task.id} className="grid gap-2 border-b border-br px-3 py-3 last:border-0 sm:grid-cols-[5rem_7rem_minmax(0,1fr)_auto] sm:items-center">
                      <span className="font-mono text-[var(--fs-xs)] text-dim">{task.id}</span>
                      <span className={`w-fit rounded border px-2 py-0.5 font-mono text-[9px] uppercase ${toneForStatus(task.status)}`}>{task.status.replaceAll('_', ' ')}</span>
                      <div className="min-w-0">
                        <div className="break-words text-sm text-tx">{task.title || 'Untitled task'}</div>
                        {(task.priority || task.dependsOn?.length) && (
                          <div className="mt-1 font-mono text-[9px] text-dim">
                            {task.priority && <span>priority: {task.priority}</span>}
                            {task.priority && task.dependsOn?.length ? <span> / </span> : null}
                            {task.dependsOn?.length ? <span>depends on: {task.dependsOn.join(', ')}</span> : null}
                          </div>
                        )}
                      </div>
                      {github && task.githubIssue && (
                        <a href={`${github.issues}/${task.githubIssue}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-cy hover:underline">issue #{task.githubIssue} {'\u2197'}</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section id="activity" eyebrow="Runner history" title="Recent activity">
              {!metrics || metrics.recentEvents.length === 0 ? (
                <p className="text-sm text-dim">No recent runner events have been recorded for this project.</p>
              ) : (
                <div className="space-y-2">
                  {metrics.recentEvents.map((event, index) => (
                    <div key={`${event.timestamp}-${event.taskId}-${index}`} className="flex items-start gap-3 rounded-[var(--r)] border border-br bg-[var(--c2)]/45 p-3">
                      <span className={event.aborted ? 'text-warn' : event.success ? 'text-ok' : 'text-er'}>{event.aborted ? '\u00D7' : event.success ? '\u2713' : '\u2717'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="break-words text-sm text-tx">{event.taskTitle || event.taskId || 'Runner event'}</div>
                        <div className="mt-1 flex flex-wrap gap-2 font-mono text-[9px] text-dim"><span>{event.backend}</span><span>/</span><span>{event.timestamp ? <RelativeTime iso={event.timestamp} /> : 'unknown time'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section id="context" eyebrow="Handoff context" title="Project context">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-sec">{project.quickContext || 'No quick context is available.'}</p>
            </Section>
          </div>

          <aside className="space-y-4">
            <Section id="health" eyebrow="Quality signals" title="Health breakdown">
              <div className="space-y-3">
                {health.factors.map((factor) => (
                  <div key={factor.name}>
                    <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[10px]"><span className="text-sec">{factor.name}</span><span className="text-dim">{factor.score}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--c2)]"><div className="h-full rounded-full" style={{ width: `${factor.score}%`, backgroundColor: factor.score >= 75 ? 'var(--ok)' : factor.score >= 50 ? 'var(--warn)' : 'var(--er)' }} /></div>
                    <div className="mt-1 text-[10px] text-dim">{factor.detail}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="controls" eyebrow="Project control" title="Runner controls">
              <div className="space-y-3">
                <RunButton project={project.name} label={'\u25B6 Start project run'} variant="primary" disabled={!canRun} disabledReason={runDisabledReason} />
                <RunButton project={project.name} dryRun label="Dry run" disabled={!scan.runner.available || isRunning} disabledReason={!scan.runner.available ? 'aahp is not available' : 'An agent is already running'} />
                {project.activeSessions.map((session) => (
                  <div key={`${session.repoName}-${session.taskId}`} className="rounded-[var(--r)] border border-[rgba(14,169,125,0.3)] bg-[var(--ok-soft)] p-3">
                    <div className="font-mono text-[10px] text-ok">{session.taskId} / {session.backend}</div>
                    <p className="mt-1 break-words text-[var(--fs-xs)] text-sec">{session.taskTitle || session.lastLine || 'Active agent'}</p>
                    <div className="mt-3"><AbortButton repoName={session.repoName} taskId={session.taskId} disabled={scan.controlPort === null} disabledReason="Runner control port is unavailable" /></div>
                  </div>
                ))}
                {!isRunning && <p className="text-[var(--fs-xs)] text-dim">No agent is currently running for this project.</p>}
              </div>
            </Section>

            <Section id="metadata" eyebrow="Metrics detail" title="Operational details">
              <dl className="space-y-2 text-[var(--fs-xs)]">
                <div className="flex justify-between gap-4"><dt className="text-dim">Runs (24h / 7d)</dt><dd className="font-mono text-sec">{metrics ? `${metrics.runs24h} / ${metrics.runs7d}` : '-'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-dim">Average turns</dt><dd className="font-mono text-sec">{metrics ? metrics.avgTurns.toFixed(1) : '-'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-dim">Aborted runs</dt><dd className="font-mono text-sec">{metrics ? metrics.abortedRuns : '-'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-dim">Tokens in / out</dt><dd className="font-mono text-sec">{metrics && metrics.tokens.recordedRuns > 0 ? `${formatTokens(metrics.tokens.inputTokens)} / ${formatTokens(metrics.tokens.outputTokens)}` : '-'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-dim">Cache hit rate</dt><dd className="font-mono text-sec">{metrics && metrics.tokens.recordedRuns > 0 ? `${metrics.tokens.cacheHitRate}%` : '-'}</dd></div>
              </dl>
              {metrics && metrics.dailyRuns.length >= 2 && <div className="mt-4"><Sparkline data={metrics.dailyRuns} width={260} height={46} /></div>}
              {github && <a href={github.security} target="_blank" rel="noopener noreferrer" className="akido-link-btn mt-4">Security {'\u2197'}</a>}
            </Section>
          </aside>
        </div>
      </main>
    </>
  );
}