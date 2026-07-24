'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RunButton } from './run-button';
import { formatTokens } from '@/lib/format';

export interface BriefingTokenStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheHitRate: number;
  recordedRuns: number;
}

interface MorningBriefingProps {
  scannedAt: string;
  totalProjects: number;
  totalReady: number;
  runningCount: number;
  runnerAvailable: boolean;
  controlPort: number | null;
  metricsFile: string | null;
  totals?: {
    totalRuns: number;
    successRate: number;
    avgDurationMs?: number;
    tokens: BriefingTokenStats;
  };
  topReadyTasks: Array<{
    repoName: string;
    taskId: string;
    title: string;
    priority?: string;
  }>;
}

export function MorningBriefing({
  scannedAt,
  totalProjects,
  totalReady,
  runningCount,
  runnerAvailable,
  controlPort,
  totals,
  topReadyTasks,
}: MorningBriefingProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);

  const now = new Date(scannedAt);
  const hour = now.getHours();

  const todayStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeOfDay =
    hour >= 5 && hour < 12
      ? { greeting: 'Good morning', label: 'MORNING', icon: '☀' }
      : hour >= 12 && hour < 17
        ? { greeting: 'Good afternoon', label: 'AFTERNOON', icon: '🌤' }
        : hour >= 17 && hour < 21
          ? { greeting: 'Good evening', label: 'EVENING', icon: '🌆' }
          : { greeting: 'Working late', label: 'NIGHT OWL', icon: '🌙' };

  const runnerActive = runnerAvailable && controlPort !== null;
  const allDisabled = !runnerAvailable || runnerActive || totalReady === 0;
  const allReason = !runnerAvailable
    ? 'aahp binary not on PATH'
    : runnerActive
      ? `aahp run active on port :${controlPort}`
      : totalReady === 0
        ? 'no ready tasks across the workspace'
        : undefined;

  return (
    <section className="mb-5 rounded-[var(--r-lg)] border border-[rgba(0,180,216,0.3)] bg-[rgba(14,23,56,0.85)] backdrop-blur-md p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[rgba(27,42,89,0.7)]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[rgba(0,180,216,0.12)] border border-[rgba(0,180,216,0.3)] flex items-center justify-center text-cy text-lg font-bold shadow-[0_0_12px_rgba(0,180,216,0.3)]">
            {timeOfDay.icon}
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-widest text-cy uppercase">
              {`// EXECUTIVE ${timeOfDay.label} BRIEFING`}
            </div>
            <h2 className="text-lg font-bold text-tx tracking-tight">
              {timeOfDay.greeting}! <span className="text-sec font-normal">· {todayStr}</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="akido-link-btn text-[11px]"
            title={collapsed ? 'Expand Briefing' : 'Collapse Briefing'}
          >
            {collapsed ? '▼ Expand Briefing' : '▲ Collapse'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-4 space-y-4">
          {/* Quick Metrics Ticker */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[var(--fs-xs)]">
            <Link
              href="/?filter=running"
              className="rounded-[var(--r)] border border-br bg-[var(--c1)] px-3.5 py-2.5 hover:border-[var(--ok)] hover:bg-[var(--c2)] transition-all group cursor-pointer text-left block"
              title="Click to filter dashboard to running agents"
            >
              <span className="text-dim text-[10px] uppercase block tracking-wider mb-1 group-hover:text-ok">
                LIVE AGENTS ↗
              </span>
              <span
                className={`text-base font-bold ${runningCount > 0 ? 'text-ok animate-pulse' : 'text-tx'}`}
              >
                {runningCount} {runningCount === 1 ? 'Agent' : 'Agents'} Running
              </span>
            </Link>

            <Link
              href="/?filter=ready"
              className="rounded-[var(--r)] border border-br bg-[var(--c1)] px-3.5 py-2.5 hover:border-[var(--cy)] hover:bg-[var(--c2)] transition-all group cursor-pointer text-left block"
              title="Click to filter dashboard to ready tasks"
            >
              <span className="text-dim text-[10px] uppercase block tracking-wider mb-1 group-hover:text-cy">
                READY TASKS ↗
              </span>
              <span className="text-base font-bold text-cy">
                {totalReady} Tasks Ready
              </span>
            </Link>

            <Link
              href="/"
              className="rounded-[var(--r)] border border-br bg-[var(--c1)] px-3.5 py-2.5 hover:border-tx hover:bg-[var(--c2)] transition-all group cursor-pointer text-left block"
              title="Click to show all repositories"
            >
              <span className="text-dim text-[10px] uppercase block tracking-wider mb-1 group-hover:text-tx">
                ESTATE REPOS ↗
              </span>
              <span className="text-base font-bold text-tx">
                {totalProjects} Repos Scanned
              </span>
            </Link>

            <Link
              href="/metrics"
              className="rounded-[var(--r)] border border-br bg-[var(--c1)] px-3.5 py-2.5 hover:border-[var(--ok)] hover:bg-[var(--c2)] transition-all group cursor-pointer text-left block"
              title="Click to view detailed metrics & token spend"
            >
              <span className="text-dim text-[10px] uppercase block tracking-wider mb-1 group-hover:text-ok">
                PASS RATE / TOKENS ↗
              </span>
              <span className="text-base font-bold text-ok">
                {totals ? `${totals.successRate}%` : '100%'}
                {totals && totals.tokens.inputTokens > 0 && (
                  <span className="text-sec text-[11px] font-normal ml-1.5">
                    ({formatTokens(totals.tokens.inputTokens + totals.tokens.outputTokens)})
                  </span>
                )}
              </span>
            </Link>
          </div>

          {/* Action Row & Top Priority Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
            {/* Quick Actions Panel */}
            <div className="rounded-[var(--r)] border border-[rgba(0,180,216,0.2)] bg-[rgba(19,31,74,0.6)] p-3.5 space-y-3">
              <div className="font-mono text-[11px] font-bold text-cy uppercase tracking-wider">
                ⚡ MORNING QUICK ACTIONS
              </div>
              <div className="flex flex-wrap gap-2">
                <RunButton
                  all
                  label="▶ Start Morning Run"
                  variant="primary"
                  disabled={allDisabled}
                  disabledReason={allReason}
                  confirmMessage={`Start aahp run --all? Will spawn agents across all ready tasks (${totalReady}).`}
                />
                <RunButton
                  all
                  dryRun
                  label="🔍 Dry Run"
                  disabled={!runnerAvailable}
                  disabledReason={runnerAvailable ? undefined : 'aahp binary not on PATH'}
                />
                <Link href="/posture" className="akido-link-btn text-[11px]">
                  🛡 Security & Posture
                </Link>
                <a
                  href="https://github.com/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="akido-link-btn text-[11px]"
                >
                  🐙 GitHub Issues
                </a>
                <a
                  href="https://github.com/pulls"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="akido-link-btn text-[11px]"
                >
                  🔀 GitHub PRs
                </a>
              </div>
            </div>

            {/* Top Priority Tasks Ticker */}
            <div className="lg:col-span-2 rounded-[var(--r)] border border-br bg-[var(--c1)] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-[11px] font-bold text-sec uppercase tracking-wider">
                  📋 NEXT PRIORITY TASKS TO EXECUTE ({topReadyTasks.length})
                </div>
                <span className="text-[10px] text-dim font-mono">Auto-prioritized</span>
              </div>
              {topReadyTasks.length === 0 ? (
                <p className="text-dim font-mono text-[11px] py-1">
                  ✓ All tasks completed! No ready tasks pending across the workspace.
                </p>
              ) : (
                <ul className="space-y-1.5 font-mono text-[11px]">
                  {topReadyTasks.slice(0, 4).map((t) => (
                    <li
                      key={`${t.repoName}-${t.taskId}`}
                      className="flex items-center gap-2 min-w-0 py-0.5 border-b border-br/40 last:border-0"
                    >
                      <span className="text-cy font-bold shrink-0">{t.repoName}</span>
                      <span className="text-dim shrink-0">{t.taskId}</span>
                      <span className="text-tx truncate flex-1" title={t.title}>
                        {t.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
