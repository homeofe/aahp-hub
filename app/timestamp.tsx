'use client';

import { useEffect, useState } from 'react';

function formatRelative(deltaMs: number): string {
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RelativeTime({ iso }: { iso: string }): React.ReactElement {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) {
    return <span className="text-text-faint">unknown</span>;
  }
  return <span>{formatRelative(now - ts)}</span>;
}
