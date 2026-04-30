'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type AbortState = 'idle' | 'pending' | 'aborted' | 'error';

interface AbortButtonProps {
  repoName: string;
  taskId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function AbortButton({
  repoName,
  taskId,
  disabled = false,
  disabledReason,
}: AbortButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AbortState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    if (disabled || state !== 'idle') return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Abort agent on ${repoName} / ${taskId}?`)
    ) {
      return;
    }
    setState('pending');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName, taskId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        aborted?: boolean;
      } | null;
      if (response.ok && payload?.aborted) {
        setState('aborted');
        startTransition(() => router.refresh());
      } else {
        setState('error');
        setErrorMessage(payload?.error ?? `HTTP ${response.status}`);
      }
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const baseClasses =
    'px-2 py-0.5 text-[11px] rounded border font-mono transition-colors';

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason ?? 'unavailable'}
        className={`${baseClasses} border-border bg-bg-elevated/50 text-text-faint cursor-not-allowed`}
      >
        abort
      </button>
    );
  }

  if (state === 'aborted') {
    return (
      <span className={`${baseClasses} border-status-blocked/40 bg-status-blocked/15 text-status-blocked`}>
        aborted
      </span>
    );
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
        className={`${baseClasses} border-status-error/40 bg-status-error/10 text-status-error hover:bg-status-error/20`}
      >
        retry
      </button>
    );
  }

  const busy = state === 'pending' || isPending;
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`${baseClasses} border-status-blocked/40 bg-status-blocked/10 text-status-blocked hover:bg-status-blocked/20 ${busy ? 'opacity-50 cursor-progress' : ''}`}
    >
      {busy ? 'aborting...' : 'abort'}
    </button>
  );
}
