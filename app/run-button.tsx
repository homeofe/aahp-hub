'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './toast-provider';

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
  const { toast } = useToast();
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
        toast(dryRun ? 'Dry run started' : `Run started${project ? ` for ${project}` : ''}`, 'success');
        startTransition(() => router.refresh());
        setTimeout(() => setState('idle'), 4000);
      } else {
        const message = payload?.error ?? `HTTP ${response.status}`;
        setState('error');
        setErrorMessage(message);
        toast(`Unable to start run: ${message}`, 'error');
      }
    } catch (err) {
      toast(`Unable to start run: ${err instanceof Error ? err.message : String(err)}`, 'error');
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
        className="hub-link-btn is-disabled"
      >
        {label}
      </button>
    );
  }

  if (state === 'started') {
    return <span className="hub-link-btn tone-ok">started</span>;
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
        className="hub-link-btn tone-er"
      >
        retry
      </button>
    );
  }

  const busy = state === 'pending' || isPending;
  const cls = variant === 'primary' ? 'hub-link-btn is-primary' : 'hub-link-btn';
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
