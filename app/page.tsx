import { scanProjects, type ProjectSummary, type TaskStatus } from '@/lib/manifest';
import { AutoRefresh, RefreshButton } from './auto-refresh';
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

function ProjectCard({ project }: { project: ProjectSummary }): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5 flex flex-col gap-3 hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text truncate" title={project.name}>
            {project.name}
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
            <p className="text-sm text-text-dim mt-1">
              Last updated: <RelativeTime iso={result.scannedAt} />
              {result.rootDir && (
                <>
                  {' '}
                  <span className="text-text-faint">
                    | {result.projects.length} project
                    {result.projects.length === 1 ? '' : 's'} in{' '}
                    <code className="font-mono">{result.rootDir}</code>
                  </span>
                </>
              )}
            </p>
          </div>
          <RefreshButton />
        </header>

        {result.projects.length === 0 ? (
          <EmptyState rootDir={result.rootDir} hasErrors={result.errors.length > 0} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.projects.map((p) => (
              <ProjectCard key={p.path} project={p} />
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

        <footer className="mt-12 pt-6 border-t border-border flex items-center justify-between text-xs text-text-faint">
          <div className="flex gap-4">
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
        </footer>
      </main>
    </>
  );
}
