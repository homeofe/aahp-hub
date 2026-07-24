import Link from 'next/link';
import type { HealthScore } from '@/lib/health';
import { RelativeTime } from './timestamp';

interface AtRiskProject {
  id: string;
  name: string;
  health: HealthScore;
  lastUpdated: string;
  readyTasks: number;
  githubRepo: string | null;
}

export function AtRiskWidget({ projects }: { projects: AtRiskProject[] }): React.ReactElement {
  if (projects.length === 0) {
    return (
      <div className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-3.5">
        <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ok">{'\u2713'} All projects healthy</div>
        <p className="font-mono text-[var(--fs-xs)] text-dim">No at-risk projects detected.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--r)] border border-[rgba(255,77,109,0.3)] bg-[rgba(255,77,109,0.06)] p-3.5">
      <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-er">{'\u26A0'} At risk ({projects.length})</div>
      <ul className="space-y-1.5 font-mono text-[var(--fs-xs)]">
        {projects.slice(0, 5).map((project) => (
          <li key={project.id}>
            <Link href={`/projects/${project.id}`} className="flex w-full min-w-0 items-center gap-2 rounded px-1 py-1 text-left hover:bg-[var(--c2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cy" title={`Open ${project.name} workspace`}>
              <span className="shrink-0 font-bold text-er">{project.health.score}</span>
              <span className="flex-1 truncate text-tx">{project.name}</span>
              <span className="shrink-0 text-dim">{project.lastUpdated ? <RelativeTime iso={project.lastUpdated} /> : 'never'}</span>
              <span className="text-cy" aria-hidden>{'\u2192'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}