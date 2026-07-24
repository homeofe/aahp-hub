'use client';

import React from 'react';
import { RelativeTime } from './timestamp';
import { focusProjectExplorer } from './project-explorer-events';

export interface ActivityEvent {
  timestamp: string;
  repo: string;
  taskId: string;
  taskTitle: string;
  success: boolean;
  aborted: boolean;
  backend: string;
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }): React.ReactElement {
  if (events.length === 0) {
    return (
      <div className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-3.5">
        <div className="font-mono text-[11px] font-bold text-sec uppercase tracking-wider mb-2">
          {'\u23F3'} RECENT ACTIVITY
        </div>
        <p className="text-dim font-mono text-[var(--fs-xs)]">No recent runner activity recorded.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-3.5">
      <div className="font-mono text-[11px] font-bold text-sec uppercase tracking-wider mb-2">
        {'\u23F3'} RECENT ACTIVITY ({events.length})
      </div>
      <ul className="space-y-1 font-mono text-[var(--fs-xs)]">
        {events.map((event, index) => {
          const icon = event.aborted ? '\u00D7' : event.success ? '\u2713' : '\u2717';
          const iconColor = event.aborted ? 'text-warn' : event.success ? 'text-ok' : 'text-er';
          return (
            <li key={`${event.timestamp}-${event.repo}-${event.taskId}-${index}`}>
              <button
                type="button"
                onClick={() => focusProjectExplorer({ project: event.repo })}
                className="flex w-full items-center gap-2 min-w-0 rounded px-1 py-0.5 text-left hover:bg-[var(--c2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cy"
                title={`Show ${event.repo} in the project grid`}
              >
                <span className={`shrink-0 ${iconColor}`}>{icon}</span>
                <span className="text-cy shrink-0 max-w-[120px] truncate">{event.repo}</span>
                <span className="text-sec truncate flex-1" title={event.taskTitle || event.taskId}>
                  {event.taskTitle || event.taskId}
                </span>
                <span className="text-dim shrink-0 text-[10px]">
                  <RelativeTime iso={event.timestamp} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}