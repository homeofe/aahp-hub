'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface NavItem {
  href: string;
  icon: string;
  label: string;
  group?: string;
  isExpandable?: boolean;
}

interface ProjectTreeNode {
  name: string;
  path: string;
  phase: string;
  readyTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  totalTasks: number;
  isRunning: boolean;
  githubRepo: string | null;
}

const NAV: NavItem[] = [
  { href: '/', icon: '▦', label: 'Overview', isExpandable: true },
  { href: '/metrics', icon: '◆', label: 'Metrics', group: 'WORK' },
  { href: '/sessions', icon: '◉', label: 'Sessions' },
  { href: '/logs', icon: '≡', label: 'Logs' },
  { href: '/posture', icon: '🛡', label: 'Posture', group: 'SECURITY' },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [treeExpanded, setTreeExpanded] = useState(true);
  const [projects, setProjects] = useState<ProjectTreeNode[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  useEffect(() => {
    let unmounted = false;
    async function fetchProjects(): Promise<void> {
      setLoading(true);
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = (await res.json()) as { projects: ProjectTreeNode[] };
          if (!unmounted && Array.isArray(data.projects)) {
            setProjects(data.projects);
          }
        }
      } catch {
        // ignore fetch error
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    fetchProjects();
    return () => {
      unmounted = true;
    };
  }, []);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const handleProjectClick = (projectName: string): void => {
    if (pathname === '/') {
      const card = document.querySelector(`[data-name="${projectName}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('ring-2', 'ring-[var(--cy)]');
        setTimeout(() => card.classList.remove('ring-2', 'ring-[var(--cy)]'), 2000);
      }
    } else {
      router.push(`/?project=${encodeURIComponent(projectName)}`);
    }
  };

  return (
    <aside className="w-[230px] shrink-0 border-r border-br bg-[rgba(14,23,56,0.92)] backdrop-blur-md flex flex-col justify-between h-screen sticky top-0">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 border-b border-br">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cy shadow-[0_0_8px_rgba(0,180,216,0.8)]" />
            <h1
              className="text-[var(--fs-base)] font-bold tracking-wide text-tx"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <span className="text-cy">AAHP</span> Hub
            </h1>
          </div>
          <p className="text-[9px] text-dim mt-1 font-mono uppercase tracking-widest leading-tight">
            Executive Command Center
          </p>
        </div>

        <nav className="py-2">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <div key={item.href}>
                {item.group && (
                  <div className="px-4 pt-4 pb-1 font-mono text-[9px] tracking-widest text-dim uppercase opacity-80">
                    {`// ${item.group}`}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Link
                    href={item.href}
                    className={`flex-1 flex items-center gap-3 px-4 py-2 text-[var(--fs-sm)] font-mono transition-all ${
                      active
                        ? 'text-cy bg-[var(--cy-glow)] border-l-2 border-cy -ml-px font-bold shadow-[inset_4px_0_12px_rgba(0,180,216,0.15)]'
                        : 'text-sec hover:text-tx hover:bg-[var(--c2)]'
                    }`}
                  >
                    <span className="text-[var(--fs-sm)] w-4 text-center" aria-hidden>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>

                  {item.isExpandable && (
                    <button
                      onClick={() => setTreeExpanded(!treeExpanded)}
                      className="px-3 py-2 text-dim hover:text-cy font-mono text-[10px]"
                      title={treeExpanded ? 'Collapse project tree' : 'Expand project tree'}
                    >
                      {treeExpanded ? '▾' : '▸'}
                    </button>
                  )}
                </div>

                {/* Expandable Project Tree under Overview */}
                {item.isExpandable && treeExpanded && (
                  <div className="pl-6 pr-2 py-1 space-y-1 font-mono text-[11px] animate-in fade-in duration-100 border-l border-br/40 ml-5">
                    {projects.length > 5 && (
                      <input
                        type="text"
                        placeholder="Search tree..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full px-2 py-1 mb-1 rounded bg-[var(--c2)] border border-br text-[10px] text-tx placeholder:text-dim focus:outline-none focus:border-cy"
                      />
                    )}

                    {loading && projects.length === 0 && (
                      <p className="text-[10px] text-dim px-2 py-1">Loading projects...</p>
                    )}

                    {filteredProjects.map((p, idx) => (
                      <button
                        key={`${p.name}-${p.path}-${idx}`}
                        onClick={() => handleProjectClick(p.name)}
                        className="w-full text-left px-2 py-1 rounded hover:bg-[var(--c2)] transition-colors flex items-center justify-between gap-1 group"
                        title={`${p.name} (${p.readyTasks} ready, ${p.doneTasks} done)`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-[8px] ${
                              p.isRunning
                                ? 'text-ok animate-pulse'
                                : p.readyTasks > 0
                                  ? 'text-warn'
                                  : 'text-dim'
                            }`}
                          >
                            ●
                          </span>
                          <span className="truncate text-sec group-hover:text-tx">{p.name}</span>
                        </span>
                        {p.readyTasks > 0 && (
                          <span className="text-[9px] text-cy font-bold px-1 rounded bg-[var(--cy-soft)]">
                            {p.readyTasks}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="px-4 py-3 border-t border-br text-[9px] font-mono text-dim space-y-1 bg-[var(--c1)]">
        <div className="flex items-center justify-between text-sec">
          <span>AAHP Hub</span>
          <span className="text-cy">v3.8.1</span>
        </div>
        <a
          href="https://github.com/homeofe/aahp-hub"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cy block truncate"
        >
          homeofe/aahp-hub
        </a>
      </div>
    </aside>
  );
}
