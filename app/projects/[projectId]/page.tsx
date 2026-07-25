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
import { ProjectRepositoryPanel } from '../../project-repository-panel';
import { ProjectSectionNav } from '../../project-section-nav';
import { RelativeTime } from '../../timestamp';
import { RunButton } from '../../run-button';
import { Sparkline } from '../../sparkline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function progressPercent(project: ProjectSummary): number {
  return project.totalTasks > 0 ? Math.round((project.doneTasks / project.totalTasks) * 100) : 100;
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
    <div className="group rounded-[var(--r)] border border-br bg-[linear-gradient(145deg,rgba(14,23,56,0.96),rgba(19,31,74,0.54))] p-4 transition hover:-translate-y-0.5 hover:border-[rgba(0,180,216,0.36)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
      <div className="font-mono text-[9px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-[var(--fs-xs)] text-dim">{note}</div>
    </div>
  );
}

function Section({ id, title, eyebrow, children }: { id: string; title: string; eyebrow: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section id={id} className="scroll-mt-20 rounded-[var(--r-lg)] border border-br bg-[linear-gradient(145deg,rgba(14,23,56,0.88),rgba(9,17,43,0.78))] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.16)]">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cy">{eyebrow}</div>
          <h2 className="mt-1 text-base font-semibold text-tx">{title}</h2>
        </div>
        <a href="#overview" className="font-mono text-[9px] text-dim transition hover:text-cy" aria-label={`Back to project overview from ${title}`}>
          {'\u2191'} top
        </a>
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
  // The git origin remote is authoritative; the manifest field is only a
  // fallback for checkouts that have no remote at all.
  const github = githubProjectLinks(project.remote.repo ?? project.githubRepo);
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
                  <span className="hub-chip">{project.phase}</span>
                  <span className={`hub-pill ${isRunning ? 'text-ok border-[rgba(14,169,125,0.4)]' : ''}`}>
                    {isRunning ? 'running' : project.inProgressTasks > 0 ? 'in progress' : project.readyTasks > 0 ? 'ready' : project.recentlyActive ? 'recently active' : 'dormant'}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-sec">
                  {project.quickContext || 'No project context has been recorded yet.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-dim">
                  <span>agent: <span className="text-sec">{project.lastAgent}</span></span>
                  <span>updated: <span className="text-sec">{project.lastUpdated ? <RelativeTime iso={project.lastUpdated} /> : 'never'}</span></span>
                  <span>path: <span className="text-sec">{redactHome(project.path)}</span></span>
                  <span>context: <span className="text-sec">{project.quickContextSource === 'status' ? 'STATUS.md fallback' : project.quickContextSource}</span></span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {github && (
                <>
                  <a className="hub-link-btn is-primary" href={github.repository} target="_blank" rel="noopener noreferrer">Repository {'\u2197'}</a>
                  <a className="hub-link-btn" href={github.issues} target="_blank" rel="noopener noreferrer">Issues</a>
                  <a className="hub-link-btn" href={github.pulls} target="_blank" rel="noopener noreferrer">Pull requests</a>
                  <a className="hub-link-btn" href={github.actions} target="_blank" rel="noopener noreferrer">Actions</a>
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

        <ProjectSectionNav />

        <section id="overview" className="scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cy">Project snapshot</div>
              <h2 className="mt-1 text-base font-semibold text-tx">What matters right now</h2>
            </div>
            <span className="font-mono text-[10px] text-dim">Live handoff and runner state</span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Tasks" value={`${project.doneTasks}/${project.totalTasks}`} note={project.totalTasks === 0 ? 'No formal tasks in current handoff' : `${project.readyTasks} ready / ${project.inProgressTasks} active`} tone="text-cy" />
            <MetricCard label="Health" value={`${health.score}/100`} note={`Grade ${health.grade}`} tone={health.score >= 75 ? 'text-ok' : health.score >= 50 ? 'text-warn' : 'text-er'} />
            <MetricCard label="Success" value={metrics ? `${metrics.successRate}%` : '-'} note={metrics ? `${metrics.totalRuns} recorded runs` : 'No runner metrics'} tone={metrics && metrics.successRate >= 80 ? 'text-ok' : 'text-warn'} />
            <MetricCard label="Average run" value={metrics ? formatDuration(metrics.avgDurationMs) : '-'} note={metrics ? `${metrics.runs7d} runs in 7 days` : 'No runner metrics'} />
          </div>
        </section>

        <div className="mt-4 space-y-4">
          <Section id="repository" eyebrow="Repository" title="Issues, pull requests and alerts">
            <ProjectRepositoryPanel projectId={project.id} remote={project.remote} />
          </Section>

          <Section id="tasks" eyebrow="Execution queue" title={`Tasks (${project.tasks.length})`}>
            {project.tasks.length === 0 ? (
              <p className="text-sm text-dim">No formal tasks are currently recorded. This usually means the roadmap is complete or future work has not been promoted to formal tasks.</p>
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
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
              <div>
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
              </div>
              <div className="rounded-[var(--r)] border border-br bg-[var(--c2)]/35 p-4">
                <div className="font-mono text-[9px] uppercase tracking-wider text-dim">Operational details</div>
                <dl className="mt-3 space-y-2 text-[var(--fs-xs)]">
                  <div className="flex justify-between gap-4"><dt className="text-dim">Runs (24h / 7d)</dt><dd className="font-mono text-sec">{metrics ? `${metrics.runs24h} / ${metrics.runs7d}` : '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-dim">Average turns</dt><dd className="font-mono text-sec">{metrics ? metrics.avgTurns.toFixed(1) : '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-dim">Aborted runs</dt><dd className="font-mono text-sec">{metrics ? metrics.abortedRuns : '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-dim">Tokens in / out</dt><dd className="font-mono text-sec">{metrics && metrics.tokens.recordedRuns > 0 ? `${formatTokens(metrics.tokens.inputTokens)} / ${formatTokens(metrics.tokens.outputTokens)}` : '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-dim">Cache hit rate</dt><dd className="font-mono text-sec">{metrics && metrics.tokens.recordedRuns > 0 ? `${metrics.tokens.cacheHitRate}%` : '-'}</dd></div>
                </dl>
                {metrics && metrics.dailyRuns.length >= 2 && <div className="mt-4"><Sparkline data={metrics.dailyRuns} width={260} height={46} /></div>}
              </div>
            </div>
          </Section>

          <Section id="health" eyebrow="Quality signals" title="Health breakdown">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {health.factors.map((factor) => (
                <div key={factor.name} className="rounded-[var(--r)] border border-br bg-[var(--c2)]/35 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[10px]"><span className="text-sec">{factor.name}</span><span className="text-dim">{factor.score}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--c2)]"><div className="h-full rounded-full" style={{ width: `${factor.score}%`, backgroundColor: factor.score >= 75 ? 'var(--ok)' : factor.score >= 50 ? 'var(--warn)' : 'var(--er)' }} /></div>
                  <div className="mt-2 text-[10px] text-dim">{factor.detail}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="context" eyebrow="Handoff context" title="Project context">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-sec">{project.quickContext || 'No quick context is available.'}</p>
              <dl className="rounded-[var(--r)] border border-br bg-[var(--c2)]/35 p-4 text-[var(--fs-xs)]">
                <div className="mb-3 font-mono text-[9px] uppercase tracking-wider text-dim">Source details</div>
                <div className="mb-2 flex justify-between gap-4"><dt className="text-dim">Agent</dt><dd className="font-mono text-sec">{project.lastAgent}</dd></div>
                <div className="mb-2 flex justify-between gap-4"><dt className="text-dim">Phase</dt><dd className="font-mono text-sec">{project.phase}</dd></div>
                <div className="mb-2 flex justify-between gap-4"><dt className="text-dim">Context source</dt><dd className="font-mono text-sec">{project.quickContextSource === 'status' ? 'STATUS.md' : project.quickContextSource}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-dim">Project path</dt><dd className="break-all text-right font-mono text-sec">{redactHome(project.path)}</dd></div>
                {project.worktreeCount > 1 && (
                  <details className="mt-3 border-t border-br pt-3">
                    <summary className="cursor-pointer font-mono text-[10px] text-cy">{project.worktreeCount - 1} alternate worktree{project.worktreeCount > 2 ? 's' : ''}</summary>
                    <ul className="mt-2 space-y-1">
                      {project.alternatePaths.map((path) => <li key={path} className="break-all font-mono text-[9px] text-dim">{redactHome(path)}</li>)}
                    </ul>
                  </details>
                )}
              </dl>
            </div>
          </Section>

          <Section id="controls" eyebrow="Project control" title="Runner controls">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
              <div>
                <div className="flex flex-wrap gap-2">
                  <RunButton project={project.name} label={'\u25B6 Start project run'} variant="primary" disabled={!canRun} disabledReason={runDisabledReason} />
                  <RunButton project={project.name} dryRun label="Dry run" disabled={!scan.runner.available || isRunning} disabledReason={!scan.runner.available ? 'aahp is not available' : 'An agent is already running'} />
                </div>
                {project.activeSessions.map((session) => (
                  <div key={`${session.repoName}-${session.taskId}`} className="mt-3 rounded-[var(--r)] border border-[rgba(14,169,125,0.3)] bg-[var(--ok-soft)] p-3">
                    <div className="font-mono text-[10px] text-ok">{session.taskId} / {session.backend}</div>
                    <p className="mt-1 break-words text-[var(--fs-xs)] text-sec">{session.taskTitle || session.lastLine || 'Active agent'}</p>
                    <div className="mt-3"><AbortButton repoName={session.repoName} taskId={session.taskId} disabled={scan.controlPort === null} disabledReason="Runner control port is unavailable" /></div>
                  </div>
                ))}
                {!isRunning && <p className="mt-3 text-[var(--fs-xs)] text-dim">No agent is currently running for this project.</p>}
              </div>
              <div className="rounded-[var(--r)] border border-br bg-[var(--c2)]/35 p-4">
                <div className="font-mono text-[9px] uppercase tracking-wider text-dim">Control readiness</div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${scan.runner.available ? 'bg-ok' : 'bg-er'}`} aria-hidden />
                  <span className="text-sm text-sec">{scan.runner.available ? 'Runner available' : 'Runner unavailable'}</span>
                </div>
                <p className="mt-2 text-[var(--fs-xs)] leading-5 text-dim">{canRun ? 'This project has actionable work and can start now.' : runDisabledReason}</p>
              </div>
            </div>
          </Section>

          {github && (
            <div className="flex justify-end">
              <a href={github.security} target="_blank" rel="noopener noreferrer" className="hub-link-btn">Open repository security {'\u2197'}</a>
            </div>
          )}
          <div className="h-[70vh]" aria-hidden />
        </div>
      </main>
    </>
  );
}