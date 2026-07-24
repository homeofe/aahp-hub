'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface ProjectTreeNode {
  id: string;
  name: string;
  phase: string;
  readyTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  totalTasks: number;
  isRunning: boolean;
  githubRepo: string | null;
}

const NAV_GROUPS = [
  {
    label: 'Command',
    items: [{ href: '/', icon: '\u25A6', label: 'Fleet overview' }],
  },
  {
    label: 'Operations',
    items: [
      { href: '/metrics', icon: '\u25C6', label: 'Performance' },
      { href: '/sessions', icon: '\u25C9', label: 'Agents' },
      { href: '/logs', icon: '\u2261', label: 'Run logs' },
    ],
  },
  {
    label: 'Governance',
    items: [{ href: '/posture', icon: '\u25C8', label: 'Security posture' }],
  },
];

type ProjectScope = 'all' | 'active' | 'idle';

function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent('aahp:open-command-palette'));
}

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectTreeNode[]>([]);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ProjectScope>('all');
  const [loading, setLoading] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/projects')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Project request failed')))
      .then((data: { projects?: ProjectTreeNode[] }) => {
        if (!cancelled && Array.isArray(data.projects)) setProjects(data.projects);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects
      .filter((project) => term === '' || project.name.toLowerCase().includes(term))
      .filter((project) => scope === 'all' || (scope === 'active' ? project.isRunning || project.readyTasks + project.inProgressTasks > 0 : !project.isRunning && project.readyTasks + project.inProgressTasks === 0))
      .sort((a, b) => Number(b.isRunning) - Number(a.isRunning) || (b.readyTasks + b.inProgressTasks) - (a.readyTasks + a.inProgressTasks) || a.name.localeCompare(b.name));
  }, [projects, scope, search]);

  const isActive = (href: string): boolean => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-br bg-[rgba(7,12,30,0.96)] px-4 backdrop-blur-md lg:hidden">
        <Link href="/" className="font-mono text-sm font-bold text-tx"><span className="text-cy">AAHP</span> Hub</Link>
        <nav className="flex items-center gap-1" aria-label="Mobile navigation">
          <Link href="/" className="rounded px-2 py-1 font-mono text-[10px] text-sec hover:bg-[var(--c2)] hover:text-cy">Fleet</Link>
          <Link href="/sessions" className="rounded px-2 py-1 font-mono text-[10px] text-sec hover:bg-[var(--c2)] hover:text-cy">Agents</Link>
          <button type="button" onClick={openCommandPalette} className="rounded border border-br px-2 py-1 font-mono text-[10px] text-cy">Search</button>
        </nav>
      </header>

      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-br bg-[rgba(10,17,43,0.96)] backdrop-blur-md lg:flex">
        <div className="border-b border-br px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cy shadow-[0_0_8px_rgba(0,180,216,0.8)]" />
            <span className="font-mono text-[var(--fs-base)] font-bold tracking-wide text-tx"><span className="text-cy">AAHP</span> Hub</span>
          </Link>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-dim">Project operations console</p>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button type="button" onClick={openCommandPalette} className="flex items-center justify-between rounded-[var(--r)] border border-br bg-[var(--c1)] px-2.5 py-2 font-mono text-[10px] text-sec hover:border-cy hover:text-cy">
              <span>Search & commands</span><kbd className="text-[9px] text-dim">Ctrl K</kbd>
            </button>
            <button type="button" onClick={() => router.refresh()} className="rounded-[var(--r)] border border-br bg-[var(--c1)] px-2.5 text-cy hover:border-cy" title="Refresh current view" aria-label="Refresh current view">{'\u21BB'}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          <nav className="py-2" aria-label="Primary navigation">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-dim">{group.label}</div>
                {group.items.map((item) => (
                  <Link key={item.href} href={item.href} className={`flex items-center gap-3 border-l-2 px-4 py-2 font-mono text-[var(--fs-xs)] transition ${isActive(item.href) ? 'border-cy bg-[var(--cy-glow)] text-cy' : 'border-transparent text-sec hover:bg-[var(--c2)] hover:text-tx'}`}>
                    <span className="w-4 text-center" aria-hidden>{item.icon}</span><span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <section className="mt-2 border-t border-br pt-3">
            <button type="button" onClick={() => setProjectsExpanded((value) => !value)} className="flex w-full items-center justify-between px-4 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-dim hover:text-cy" aria-expanded={projectsExpanded}>
              <span>Projects ({projects.length})</span><span>{projectsExpanded ? '\u25BE' : '\u25B8'}</span>
            </button>
            {projectsExpanded && (
              <div className="px-3 pt-2">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a project..." aria-label="Find a project" className="w-full rounded-[var(--r)] border border-br bg-[var(--c1)] px-2.5 py-2 font-mono text-[10px] text-tx outline-none placeholder:text-dim focus:border-cy" />
                <div className="my-2 flex gap-1">
                  {(['all', 'active', 'idle'] as const).map((item) => <button key={item} type="button" onClick={() => setScope(item)} className={`flex-1 rounded border px-1.5 py-1 font-mono text-[9px] capitalize ${scope === item ? 'border-cy bg-[var(--cy-glow)] text-cy' : 'border-br text-dim hover:text-sec'}`}>{item}</button>)}
                </div>
                <div className="space-y-0.5">
                  {loading && <p className="px-2 py-2 font-mono text-[10px] text-dim">Loading projects...</p>}
                  {!loading && filteredProjects.length === 0 && <p className="px-2 py-2 font-mono text-[10px] text-dim">No matching projects.</p>}
                  {filteredProjects.map((project) => {
                    const active = pathname === `/projects/${project.id}`;
                    return (
                      <Link key={project.id} href={`/projects/${project.id}`} className={`flex items-center gap-2 rounded px-2 py-1.5 font-mono text-[10px] transition ${active ? 'bg-[var(--cy-glow)] text-cy' : 'text-sec hover:bg-[var(--c2)] hover:text-tx'}`} title={`${project.name} / ${project.phase}`}>
                        <span className={project.isRunning ? 'text-ok' : project.readyTasks + project.inProgressTasks > 0 ? 'text-warn' : 'text-dim'} aria-hidden>{'\u25CF'}</span>
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {project.readyTasks + project.inProgressTasks > 0 && <span className="rounded bg-[var(--c2)] px-1 text-[9px] text-cy">{project.readyTasks + project.inProgressTasks}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-br bg-[var(--c1)] px-4 py-3 font-mono text-[9px] text-dim">
          <div className="flex items-center justify-between"><span>AAHP Hub</span><span className="text-cy">v3.8.1</span></div>
          <a href="https://github.com/homeofe/aahp-hub" target="_blank" rel="noopener noreferrer" className="mt-1 block truncate hover:text-cy">homeofe/aahp-hub {'\u2197'}</a>
        </div>
      </aside>
    </>
  );
}