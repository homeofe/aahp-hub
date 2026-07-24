'use client';

import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const borderColor = (t: ToastType): string =>
    t === 'success' ? 'border-[rgba(14,169,125,0.5)]'
    : t === 'warning' ? 'border-[rgba(255,183,3,0.5)]'
    : t === 'error' ? 'border-[rgba(255,77,109,0.5)]'
    : 'border-[rgba(0,180,216,0.5)]';

  const bgColor = (t: ToastType): string =>
    t === 'success' ? 'bg-[rgba(14,169,125,0.12)]'
    : t === 'warning' ? 'bg-[rgba(255,183,3,0.12)]'
    : t === 'error' ? 'bg-[rgba(255,77,109,0.12)]'
    : 'bg-[rgba(0,180,216,0.12)]';

  const textColor = (t: ToastType): string =>
    t === 'success' ? 'text-ok'
    : t === 'warning' ? 'text-warn'
    : t === 'error' ? 'text-er'
    : 'text-cy';

  const icon = (t: ToastType): string =>
    t === 'success' ? '\u2713'
    : t === 'warning' ? '\u26A0'
    : t === 'error' ? '\u2717'
    : '\u2139';

  return (
    <ToastContext value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-[var(--r)] border backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4)] font-mono text-[var(--fs-xs)] animate-in slide-in-from-right-4 fade-in duration-200 ${borderColor(t.type)} ${bgColor(t.type)}`}
          >
            <span className={`text-[var(--fs-sm)] ${textColor(t.type)}`}>{icon(t.type)}</span>
            <span className="text-tx">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-dim hover:text-tx ml-2 text-[var(--fs-sm)]"
            >
              {'\u2715'}
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
