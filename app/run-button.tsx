'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type RunState = 'idle' | 'pending' | 'started' | 'error';

export interface RunButtonProps {
  project?: string;
  all?: boolean;
  dryRun?: boolean;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  variant?: 'primary' | 'secondary';
  confirmMessage?: string;
}

export function RunButton({
  project,
  all,
  dryRun,
  label,
  disabled = false,
  disabledReason,
  variant = 'secondary',
  confirmMessage,
}: RunButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<RunState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    if (disabled || state === 'pending') return;
    if (
      confirmMessage &&
      typeof window !== 'undefined' &&
      !window.confirm(confirmMessage)
    ) {
      return;
    }
    setState('pending');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, all, dryRun }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        started?: boolean;
        pid?: number;
      } | null;
      if (response.ok && payload?.started) {
        setState('started');
        startTransition(() => router.refresh());
        setTimeout(() => setState('idle'), 4000);
      } else {
        setState('error');
        setErrorMessage(payload?.error ?? `HTTP ${response.status}`);
      }
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason ?? 'unavailable'}
        className="akido-link-btn is-disabled"
      >
        {label}
      </button>
    );
  }

  if (state === 'started') {
    return <span className="akido-link-btn tone-ok">started</span>;
  }

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={() => {
          setState('idle');
          setErrorMessage(null);
        }}
        title={errorMessage ?? 'unknown error'}
        className="akido-link-btn tone-er"
      >
        retry
      </button>
    );
  }

  const busy = state === 'pending' || isPending;
  const cls = variant === 'primary' ? 'akido-link-btn is-primary' : 'akido-link-btn';
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`${cls} ${busy ? 'opacity-60 cursor-progress' : ''}`}
    >
      {busy ? 'starting...' : label}
    </button>
  );
}
