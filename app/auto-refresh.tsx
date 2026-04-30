'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_INTERVAL_MS = 30_000;

export function AutoRefresh(): null {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
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
