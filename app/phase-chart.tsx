'use client';

import React from 'react';
import { focusProjectExplorer } from './project-explorer-events';

interface PhaseChartProps {
  phases: { phase: string; count: number }[];
}

const PHASE_COLORS: Record<string, string> = {
  research: '#6d47f0', architect: '#2a7fff', architecture: '#2a7fff',
  scaffold: '#00b4d8', implement: '#0ea97d', implementation: '#0ea97d',
  implementing: '#0ea97d', review: '#ffb703', fix: '#ff4d6d',
  bugfix: '#ff4d6d', done: '#0ea97d', idle: '#6b82a8',
  maintenance: '#b0c2de', release: '#0ea97d', verification: '#00b4d8',
  hardening: '#ffb703', handoff: '#6d47f0', setup: '#6b82a8', unknown: '#3a4a6e',
};

function phaseColor(phase: string): string {
  return PHASE_COLORS[phase.toLowerCase()] ?? '#4a5a7e';
}

export function PhaseChart({ phases }: PhaseChartProps): React.ReactElement {
  const total = phases.reduce((sum, phase) => sum + phase.count, 0);
  if (total === 0) return <p className="text-dim text-[var(--fs-xs)] font-mono">No projects</p>;

  const sorted = [...phases].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-[var(--c2)]">
        {sorted.map((item) => {
          const percent = (item.count / total) * 100;
          if (percent < 1) return null;
          return (
            <button
              key={item.phase}
              type="button"
              className="h-full transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              style={{ width: `${percent}%`, backgroundColor: phaseColor(item.phase) }}
              title={`${item.phase}: ${item.count} (${Math.round(percent)}%)`}
              aria-label={`Filter projects to phase ${item.phase}`}
              onClick={() => focusProjectExplorer({ phase: item.phase })}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--fs-micro)] font-mono">
        {sorted.map((item) => (
          <button
            key={item.phase}
            type="button"
            onClick={() => focusProjectExplorer({ phase: item.phase })}
            className="flex items-center gap-1 rounded px-0.5 hover:bg-[var(--c2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cy"
            title={`Filter projects to phase ${item.phase}`}
          >
            <span
              className="inline-block h-2 w-2 rounded-sm shrink-0"
              style={{ backgroundColor: phaseColor(item.phase) }}
            />
            <span className="text-sec">{item.phase}</span>
            <span className="text-dim">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}