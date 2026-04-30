'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const POLL_FALLBACK_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 250;

type Liveness = 'connecting' | 'live' | 'offline';

export function AutoRefresh(): null {
  const router = useRouter();

  useEffect(() => {
    const fallback = setInterval(() => router.refresh(), POLL_FALLBACK_MS);

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const triggerRefresh = (): void => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    const source = new EventSource('/api/stream');
    source.addEventListener('change', triggerRefresh);

    return () => {
      clearInterval(fallback);
      if (debounce) clearTimeout(debounce);
      source.close();
    };
  }, [router]);

  return null;
}

export function RefreshButton(): React.ReactElement {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="px-3 py-1.5 text-sm rounded border border-border bg-bg-elevated hover:bg-bg-card hover:border-accent text-text transition-colors"
    >
      Refresh
    </button>
  );
}

export function LiveIndicator(): React.ReactElement {
  const [state, setState] = useState<Liveness>('connecting');

  useEffect(() => {
    const source = new EventSource('/api/stream');

    source.addEventListener('hello', () => setState('live'));
    source.addEventListener('heartbeat', () => setState('live'));
    source.addEventListener('change', () => setState('live'));
    source.addEventListener('error', () => setState('offline'));

    return () => source.close();
  }, []);

  const dot =
    state === 'live'
      ? 'bg-status-done shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse'
      : state === 'offline'
        ? 'bg-status-error'
        : 'bg-text-faint';
  const label = state === 'live' ? 'live' : state === 'offline' ? 'offline' : 'connecting';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-faint">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
