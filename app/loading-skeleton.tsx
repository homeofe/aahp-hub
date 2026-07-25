'use client';

import React from 'react';

export function CardSkeleton(): React.ReactElement {
  return (
    <div className="hub-card animate-pulse">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--c3)]" />
        <span className="h-4 w-32 rounded bg-[var(--c3)]" />
        <span className="ml-auto h-4 w-16 rounded bg-[var(--c3)]" />
      </div>
      <div className="flex items-center gap-2">
        <span className="h-4 w-16 rounded bg-[var(--c3)]" />
        <span className="h-3 flex-1 rounded bg-[var(--c2)]" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1"><span className="h-2 w-10 rounded bg-[var(--c2)] block" /><span className="h-4 w-12 rounded bg-[var(--c3)] block" /></div>
        <div className="space-y-1"><span className="h-2 w-10 rounded bg-[var(--c2)] block" /><span className="h-4 w-12 rounded bg-[var(--c3)] block" /></div>
        <div className="space-y-1"><span className="h-2 w-10 rounded bg-[var(--c2)] block" /><span className="h-4 w-12 rounded bg-[var(--c3)] block" /></div>
      </div>
    </div>
  );
}

export function BriefingSkeleton(): React.ReactElement {
  return (
    <div className="mb-5 rounded-[var(--r-lg)] border border-br bg-[var(--c1)] p-5 animate-pulse">
      <div className="flex items-center gap-3 pb-3">
        <span className="h-9 w-9 rounded-full bg-[var(--c3)]" />
        <div className="space-y-1.5">
          <span className="h-3 w-40 rounded bg-[var(--c3)] block" />
          <span className="h-5 w-56 rounded bg-[var(--c3)] block" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-[var(--r)] bg-[var(--c2)]" />
        ))}
      </div>
    </div>
  );
}
