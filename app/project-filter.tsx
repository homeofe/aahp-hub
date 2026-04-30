'use client';

import { useEffect, useState } from 'react';

type Filter = 'all' | 'running' | 'has-tasks' | 'idle';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'has-tasks', label: 'Has Tasks' },
  { id: 'idle', label: 'Idle' },
];

export function ProjectFilter(): React.ReactElement {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('#proj-grid > [data-name]');
    const term = search.trim().toLowerCase();
    cards.forEach((card) => {
      const name = card.dataset['name']?.toLowerCase() ?? '';
      const status = card.dataset['filter'] ?? 'idle';
      const matchesSearch = term === '' || name.includes(term);
      const matchesFilter = filter === 'all' || status === filter;
      card.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
  }, [search, filter]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <input
        type="text"
        placeholder="🔍  Search projects..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-c1 border border-br rounded-[var(--r)] text-tx text-[var(--fs-sm)] px-3 py-1.5 w-56 outline-none focus:border-cy"
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
  );
}
