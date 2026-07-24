'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Filter = 'all' | 'running' | 'has-tasks' | 'idle';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Projects' },
  { id: 'running', label: '◉ Running' },
  { id: 'has-tasks', label: '⚡ Ready Tasks' },
  { id: 'idle', label: 'Idle' },
];

export function ProjectFilter(): React.ReactElement {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortOrder, setSortOrder] = useState<'updated' | 'tasks' | 'alpha'>('updated');

  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    const urlProject = searchParams.get('project');
    if (urlFilter === 'running' || urlFilter === 'has-tasks' || urlFilter === 'idle') {
      setFilter(urlFilter as Filter);
    } else if (urlFilter === 'ready') {
      setFilter('has-tasks');
    }

    if (urlProject) {
      setSearch(urlProject);
    }
  }, [searchParams]);

  useEffect(() => {
    const grid = document.getElementById('proj-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-name]'));
    const term = search.trim().toLowerCase();

    cards.forEach((card) => {
      const name = card.dataset['name']?.toLowerCase() ?? '';
      const status = card.dataset['filter'] ?? 'idle';
      const matchesSearch = term === '' || name.includes(term);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'running' && status === 'running') ||
        (filter === 'has-tasks' && (status === 'running' || status === 'has-tasks')) ||
        (filter === 'idle' && status === 'idle');

      card.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });

    // Client-side sorting of cards in grid
    cards.sort((a, b) => {
      const nameA = a.dataset['name'] ?? '';
      const nameB = b.dataset['name'] ?? '';
      if (sortOrder === 'alpha') return nameA.localeCompare(nameB);
      if (sortOrder === 'tasks') {
        const isRunningA = a.dataset['filter'] === 'running' ? 100 : 0;
        const isRunningB = b.dataset['filter'] === 'running' ? 100 : 0;
        return isRunningB - isRunningA;
      }
      return 0;
    });

    cards.forEach((c) => grid.appendChild(c));
  }, [search, filter, sortOrder]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-[var(--r)] border border-br bg-[var(--c1)] font-mono text-[var(--fs-sm)]">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="🔍 Filter projects by name..."
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
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-[var(--fs-xs)] text-sec">
        <span className="text-dim">Sort:</span>
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
