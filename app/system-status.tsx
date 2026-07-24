'use client';

import React, { useState } from 'react';

interface SystemStatusProps {
  projectCount: number;
  stubCount: number;
  totalInProgress: number;
  totalReady: number;
  totalDone: number;
  metricsAvailable: boolean;
  metricsError: string | null;
  metricsFile: string;
  sessionsAvailable: boolean;
  sessionsError: string | null;
  sessionsFile: string;
  activeSessionCount: number;
  controlPort: number | null;
  totalRuns: number;
  runs24h: number;
  runs7d: number;
  successRate: number;
  abortedRuns: number;
  tokensSummary: string | null;
  cacheSummary: string | null;
}

export function SystemStatus(props: SystemStatusProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className="mt-6 rounded-[var(--r)] border border-br bg-[var(--c1)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[var(--fs-xs)] font-mono text-dim hover:text-sec hover:bg-[var(--c2)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-cy">{'\u2630'}</span>
          <span>{props.projectCount} projects</span>
          <span className="text-br">|</span>
          <span>{props.totalReady} ready</span>
          <span className="text-br">|</span>
          <span>{props.totalDone} done</span>
          {props.metricsAvailable && (
            <>
              <span className="text-br">|</span>
              <span>{props.successRate}% success</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[9px]">{expanded ? '\u25B2 collapse' : '\u25BC system status'}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-br space-y-2 text-[var(--fs-xs)] text-dim font-mono animate-in slide-in-from-top-1 fade-in duration-150">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            <div><span className="text-sec">Projects:</span> {props.projectCount}</div>
            {props.stubCount > 0 && <div><span className="text-sec">Stubs hidden:</span> {props.stubCount}</div>}
            <div><span className="text-sec">In Progress:</span> {props.totalInProgress}</div>
            <div><span className="text-sec">Ready:</span> {props.totalReady}</div>
            <div><span className="text-sec">Done:</span> {props.totalDone}</div>
          </div>

          {props.metricsAvailable && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 pt-1 border-t border-br/50">
              <div><span className="text-sec">Total runs:</span> {props.totalRuns}</div>
              <div><span className="text-sec">24h:</span> {props.runs24h}</div>
              <div><span className="text-sec">7d:</span> {props.runs7d}</div>
              <div><span className="text-sec">Success:</span> {props.successRate}%</div>
              {props.abortedRuns > 0 && <div><span className="text-er">Aborted:</span> {props.abortedRuns}</div>}
              {props.tokensSummary && <div><span className="text-sec">Tokens:</span> {props.tokensSummary}</div>}
              {props.cacheSummary && <div><span className="text-sec">Cache:</span> {props.cacheSummary}</div>}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 pt-1 border-t border-br/50">
            {props.metricsError && <div className="text-er">Metrics: {props.metricsError}</div>}
            {!props.metricsAvailable && !props.metricsError && <div>Metrics: no file yet</div>}
            <div>Metrics: <span className="text-sec">{props.metricsFile}</span></div>
            {props.sessionsError ? (
              <div className="text-er">Sessions: {props.sessionsError}</div>
            ) : props.sessionsAvailable ? (
              <div>
                Sessions: <span className="text-sec">{props.activeSessionCount} active</span>
              </div>
            ) : (
              <div>Sessions: no file yet</div>
            )}
            {props.sessionsAvailable && (
              <div>Sessions file: <span className="text-sec">{props.sessionsFile}</span></div>
            )}
            <div>Control: {props.controlPort ? <span className="text-ok">:{props.controlPort}</span> : <span>not available</span>}</div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-br/50">
            <a
              href="https://github.com/homeofe/aahp-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cy"
            >
              homeofe/aahp-hub
            </a>
          </div>
        </div>
      )}
    </footer>
  );
}
