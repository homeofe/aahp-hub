'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './toast-provider';

type AbortState = 'idle' | 'pending' | 'aborted' | 'error';

interface AbortButtonProps {
  repoName: string;
  taskId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function AbortButton({ repoName, taskId, disabled = false, disabledReason }: AbortButtonProps): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AbortState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    if (disabled || state !== 'idle') return;
    if (typeof window !== 'undefined' && !window.confirm(`Abort agent on ${repoName} / ${taskId}?`)) return;
    setState('pending');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName, taskId }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; aborted?: boolean } | null;
      if (response.ok && payload?.aborted) {
        setState('aborted');
        toast(`Agent aborted on ${repoName} / ${taskId}`, 'warning');
        startTransition(() => router.refresh());
      } else {
        const message = payload?.error ?? `HTTP ${response.status}`;
        setState('error');
        setErrorMessage(message);
        toast(`Unable to abort agent: ${message}`, 'error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast(`Unable to abort agent: ${message}`, 'error');
      setState('error');
      setErrorMessage(message);
    }
  };

  if (disabled) return <button type="button" disabled title={disabledReason ?? 'unavailable'} className="hub-link-btn is-disabled">{'\u00D7'} abort</button>;
  if (state === 'aborted') return <span className="hub-link-btn tone-er">aborted</span>;
  if (state === 'error') return <button type="button" onClick={() => { setState('idle'); setErrorMessage(null); }} title={errorMessage ?? 'unknown error'} className="hub-link-btn tone-er">retry abort</button>;

  const busy = state === 'pending' || isPending;
  return <button type="button" onClick={handleClick} disabled={busy} className={`hub-link-btn tone-er ${busy ? 'opacity-60 cursor-progress' : ''}`}>{busy ? 'aborting...' : <>{'\u00D7'} abort</>}</button>;
}