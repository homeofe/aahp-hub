import Link from 'next/link';
import type { ProjectSummary } from '@/lib/manifest';
import type { HealthScore } from '@/lib/health';
import { HealthBadge } from './health-badge';
import { RelativeTime } from './timestamp';

function statusTone(project: ProjectSummary): { label: string; className: string } {
  if (project.activeSessions.length > 0) return { label: 'running', className: 'text-ok' };
  if (project.inProgressTasks > 0) return { label: 'in progress', className: 'text-warn' };
  if (project.readyTasks > 0) return { label: 'ready', className: 'text-cy' };
  if (project.recentlyActive) return { label: 'recent', className: 'text-cy' };
  return { label: 'dormant', className: 'text-dim' };
}

export function ProjectOverviewCard({
  project,
  health,
}: {
  project: ProjectSummary;
  health: HealthScore;
}): React.ReactElement {
  const progress = project.totalTasks > 0
    ? Math.round((project.doneTasks / project.totalTasks) * 100)
    : 0;
  const status = statusTone(project);

  return (
    <article
      className="group relative overflow-hidden rounded-[var(--r-lg)] border border-br bg-[rgba(14,23,56,0.78)] transition hover:-translate-y-0.5 hover:border-[rgba(0,180,216,0.42)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
      data-name={project.name}
      data-filter={project.activeSessions.length > 0 ? 'running' : project.readyTasks + project.inProgressTasks > 0 ? 'has-tasks' : 'idle'}
      data-phase={project.phase}
      data-task-count={project.readyTasks + project.inProgressTasks}
      data-updated={project.lastUpdated}
      data-recent={project.recentlyActive ? 'true' : 'false'}
    >
      <Link
        href={`/projects/${project.id}`}
        className="block min-h-[190px] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cy"
        aria-label={`Open ${project.name} project workspace`}
      >
        <div className="flex items-start gap-3">
          <HealthBadge score={health.score} grade={health.grade} size={34} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] ${status.className}`} aria-hidden>{'\u25CF'}</span>
              <h2 className="truncate font-mono text-[var(--fs-base)] font-bold text-tx" title={project.name}>
                {project.name}
              </h2>
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px]">
              <span className={status.className}>{status.label}</span>
              <span className="text-dim">/</span>
              <span className="truncate text-sec">{project.phase}</span>
            </div>
          </div>
          <span className="text-dim transition group-hover:translate-x-0.5 group-hover:text-cy" aria-hidden>{'\u2192'}</span>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-dim">
            <span>progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--c2)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor: progress >= 80 ? 'var(--ok)' : progress >= 40 ? 'var(--cy)' : 'var(--pu)',
              }}
            />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <div><dt className="font-mono text-[9px] uppercase text-dim">ready</dt><dd className="mt-0.5 font-mono text-sm font-bold text-cy">{project.readyTasks}</dd></div>
          <div><dt className="font-mono text-[9px] uppercase text-dim">active</dt><dd className="mt-0.5 font-mono text-sm font-bold text-warn">{project.inProgressTasks}</dd></div>
          <div><dt className="font-mono text-[9px] uppercase text-dim">done</dt><dd className="mt-0.5 font-mono text-sm font-bold text-ok">{project.doneTasks}</dd></div>
        </dl>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-br pt-3 font-mono text-[10px] text-dim">
          <span className="truncate" title={project.lastAgent}>{project.lastAgent}</span>
          <span className="shrink-0">{project.lastUpdated ? <RelativeTime iso={project.lastUpdated} /> : 'no update'}</span>
        </div>
      </Link>

    </article>
  );
}