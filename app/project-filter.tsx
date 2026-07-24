'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  PROJECT_EXPLORER_EVENT,
  type ProjectExplorerDetail,
} from './project-explorer-events';
type Filter = 'all' | 'active' | 'running' | 'has-tasks' | 'dormant';

const FILTERS: { id: Filter; label: string; title?: string }[] = [
  { id: 'all', label: 'All Projects' },
  { id: 'active', label: 'Active', title: 'Running, actionable, or updated within 7 days' },
  { id: 'running', label: '\u25C9 Running' },
  { id: 'has-tasks', label: '\u26A1 Actionable' },
  { id: 'dormant', label: 'Dormant' },
];

function filterFromParam(value: string | null): Filter {
  if (value === 'active' || value === 'running' || value === 'has-tasks' || value === 'dormant') return value;
  if (value === 'ready') return 'has-tasks';
  if (value === 'idle') return 'dormant';
  return 'all';
}

export function ProjectFilter(): React.ReactElement {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('project') ?? '');
  const [filter, setFilter] = useState<Filter>(() => filterFromParam(searchParams.get('filter')));
  const [sortOrder, setSortOrder] = useState<'updated' | 'tasks' | 'alpha'>('updated');

  const [phase, setPhase] = useState(() => searchParams.get('phase') ?? '');
  const hasActiveFilters = search.trim() !== '' || filter !== 'all' || phase !== '';

  useEffect(() => {
    const handleExplorerFocus = (event: Event): void => {
      const detail = (event as CustomEvent<ProjectExplorerDetail>).detail;
      setSearch(detail.project ?? '');
      setPhase(detail.phase ?? '');
      setFilter('all');
    };

    window.addEventListener(PROJECT_EXPLORER_EVENT, handleExplorerFocus);
    return () => window.removeEventListener(PROJECT_EXPLORER_EVENT, handleExplorerFocus);
  }, []);

  useEffect(() => {
    const grid = document.getElementById('proj-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-name]'));
    const term = search.trim().toLowerCase();
    const phaseTerm = phase.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      const name = card.dataset['name']?.toLowerCase() ?? '';
      const status = card.dataset['filter'] ?? 'idle';
      const cardPhase = card.dataset['phase']?.toLowerCase() ?? '';
      const recentlyActive = card.dataset['recent'] === 'true';
      const matchesSearch = term === '' || name.includes(term);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && (status !== 'idle' || recentlyActive)) ||
        (filter === 'running' && status === 'running') ||
        (filter === 'has-tasks' && (status === 'running' || status === 'has-tasks')) ||
        (filter === 'dormant' && status === 'idle' && !recentlyActive);
      const matchesPhase = phaseTerm === '' || cardPhase === phaseTerm;
      const visible = matchesSearch && matchesFilter && matchesPhase;

      card.style.display = visible ? '' : 'none';
      if (visible) visibleCount += 1;
    });

    // Client-side sorting of cards in grid
    cards.sort((a, b) => {
      const nameA = a.dataset['name'] ?? '';
      const nameB = b.dataset['name'] ?? '';
      if (sortOrder === 'alpha') return nameA.localeCompare(nameB);
      if (sortOrder === 'tasks') {
        const tasksA = Number(a.dataset['taskCount'] ?? 0);
        const tasksB = Number(b.dataset['taskCount'] ?? 0);
        const runningA = a.dataset['filter'] === 'running' ? 1 : 0;
        const runningB = b.dataset['filter'] === 'running' ? 1 : 0;
        return runningB - runningA || tasksB - tasksA || nameA.localeCompare(nameB);
      }
      const updatedA = Date.parse(a.dataset['updated'] ?? '') || 0;
      const updatedB = Date.parse(b.dataset['updated'] ?? '') || 0;
      return updatedB - updatedA || nameA.localeCompare(nameB);
    });

    const resultCount = document.getElementById('project-result-count');
    if (resultCount) resultCount.textContent = `${visibleCount} of ${cards.length}`;
    const emptyState = document.getElementById('project-filter-empty');
    if (emptyState) emptyState.hidden = visibleCount > 0;
    cards.forEach((c) => grid.appendChild(c));
  }, [search, filter, phase, sortOrder]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-[var(--r)] border border-br bg-[var(--c1)] font-mono text-[var(--fs-sm)]">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Filter projects by name..."
          aria-label="Filter projects by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[var(--c2)] border border-br rounded-[var(--r)] text-tx text-[var(--fs-sm)] px-3 py-1.5 w-64 outline-none focus:border-cy placeholder:text-dim"
        />

        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`akido-pill ${filter === f.id ? 'is-active' : ''}`}
              title={f.title}
            >
              {f.label}
            </button>
          ))}
        </div>
        {phase && (
          <button
            type="button"
            onClick={() => setPhase('')}
            className="akido-pill is-active"
            title="Clear phase filter"
          >
            phase: {phase} {'\u00D7'}
          </button>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilter('all');
              setPhase('');
            }}
            className="text-[var(--fs-xs)] text-dim hover:text-cy"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 font-mono text-[var(--fs-xs)] text-sec">
        <span className="text-dim">Sort:</span>
        <span id="project-result-count" className="text-dim tabular-nums" aria-live="polite" />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'updated' | 'tasks' | 'alpha')}
          className="bg-[var(--c2)] border border-br rounded-[var(--r)] text-tx px-2 py-1 outline-none focus:border-cy"
        >
          <option value="updated">Default (Last Updated)</option>
          <option value="tasks">Priority (Running & Tasks)</option>
          <option value="alpha">Alphabetical (A-Z)</option>
        </select>
      </div>
    </div>
  );
}
