'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  category: 'project' | 'page' | 'action';
  icon: string;
  onSelect: () => void;
}

const PAGES: Omit<PaletteItem, 'onSelect'>[] = [
  { id: 'nav-overview', label: 'Overview', sublabel: 'Dashboard home', category: 'page', icon: '\u25A6' },
  { id: 'nav-metrics', label: 'Metrics', sublabel: 'Runner activity & token spend', category: 'page', icon: '\u25C6' },
  { id: 'nav-sessions', label: 'Sessions', sublabel: 'Live and recent agents', category: 'page', icon: '\u25C9' },
  { id: 'nav-logs', label: 'Logs', sublabel: 'Agent log files', category: 'page', icon: '\u2261' },
  { id: 'nav-posture', label: 'Security & Posture', sublabel: 'Dependency posture', category: 'page', icon: '\uD83D\uDEE1' },
];

const ACTIONS: Omit<PaletteItem, 'onSelect'>[] = [
  { id: 'act-refresh', label: 'Refresh Dashboard', category: 'action', icon: '\u21BB' },
  { id: 'act-settings', label: 'Open Settings', category: 'action', icon: '\u2699' },
];

interface ProjectNode {
  id: string;
  name: string;
  phase: string;
  readyTasks: number;
  isRunning: boolean;
}

export function CommandPalette(): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch projects once when palette opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data: { projects: ProjectNode[] }) => {
        if (!cancelled && Array.isArray(data.projects)) setProjects(data.projects);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setSelected(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const openHandler = (): void => {
      setOpen(true);
      setQuery('');
      setSelected(0);
    };
    document.addEventListener('keydown', handler);
    window.addEventListener('aahp:open-command-palette', openHandler);
    return () => {
      document.removeEventListener('keydown', handler);
      window.removeEventListener('aahp:open-command-palette', openHandler);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const buildItems = useCallback((): PaletteItem[] => {
    const items: PaletteItem[] = [];

    // Projects
    for (const p of projects) {
      items.push({
        id: `proj-${p.id}`,
        label: p.name,
        sublabel: `${p.phase} - ${p.readyTasks} ready${p.isRunning ? ' (running)' : ''}`,
        category: 'project',
        icon: p.isRunning ? '\u25C9' : '\u25CF',
        onSelect: () => {
          setOpen(false);
          router.push(`/projects/${p.id}`);
        },
      });
    }

    // Pages
    for (const pg of PAGES) {
      const href = pg.id === 'nav-overview' ? '/' : `/${pg.id.replace('nav-', '')}`;
      items.push({ ...pg, onSelect: () => { setOpen(false); router.push(href); } });
    }

    // Actions
    for (const act of ACTIONS) {
      items.push({
        ...act,
        onSelect: () => {
          setOpen(false);
          if (act.id === 'act-refresh') router.refresh();
          if (act.id === 'act-settings') {
            const btn = document.querySelector('[title*="Settings"]') as HTMLButtonElement | null;
            btn?.click();
          }
        },
      });
    }

    return items;
  }, [projects, router]);

  if (!open) return null;

  const items = buildItems();
  const q = query.toLowerCase();
  const filtered = q.length > 0
    ? items.filter((it) => it.label.toLowerCase().includes(q) || it.sublabel?.toLowerCase().includes(q))
    : items;
  const safeSelected = Math.min(selected, filtered.length - 1);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && filtered[safeSelected]) { filtered[safeSelected]!.onSelect(); }
  };

  const categoryLabel = (c: string): string =>
    c === 'project' ? 'PROJECTS' : c === 'page' ? 'NAVIGATION' : 'ACTIONS';

  // Group by category
  const grouped = new Map<string, PaletteItem[]>();
  for (const item of filtered) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  let flatIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-100"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-[var(--r-lg)] border border-[rgba(0,180,216,0.35)] bg-[var(--c1)] shadow-[0_24px_64px_rgba(0,0,0,0.7),0_0_32px_rgba(0,180,216,0.15)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-br">
          <span className="text-cy text-[var(--fs-sm)]" aria-hidden>{'\u2315'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, pages, actions..."
            className="flex-1 bg-transparent text-tx text-[var(--fs-base)] placeholder:text-dim outline-none font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[9px] font-mono text-dim bg-[var(--c2)] border border-br rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="text-center text-dim font-mono text-[var(--fs-xs)] py-6">No matches found</p>
          )}
          {[...grouped.entries()].map(([cat, catItems]) => (
            <div key={cat}>
              <div className="px-4 pt-2.5 pb-1 font-mono text-[9px] tracking-widest text-dim uppercase">
                {categoryLabel(cat)}
              </div>
              {catItems.map((item) => {
                flatIdx++;
                const idx = flatIdx;
                const isActive = idx === safeSelected;
                return (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left font-mono text-[var(--fs-xs)] transition-colors ${
                      isActive
                        ? 'bg-[var(--cy-glow)] text-cy'
                        : 'text-sec hover:bg-[var(--c2)] hover:text-tx'
                    }`}
                    onClick={item.onSelect}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <span className={`w-4 text-center text-[var(--fs-sm)] shrink-0 ${item.category === 'project' && item.sublabel?.includes('running') ? 'text-ok animate-pulse' : ''}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-tx block truncate">{item.label}</span>
                      {item.sublabel && <span className="text-dim text-[10px] block truncate">{item.sublabel}</span>}
                    </span>
                    {item.category === 'page' && <span className="text-[10px] text-dim">{'\u21B5'}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-br text-[9px] font-mono text-dim">
          <span>{'\u2191\u2193'} navigate</span>
          <span>{'\u21B5'} select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
