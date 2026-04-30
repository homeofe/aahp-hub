import { loadAnalytics } from '@/lib/analytics';
import { formatDuration, formatTokens, loadMetrics } from '@/lib/metrics';
import { loadSessions } from '@/lib/sessions';
import { AbortButton } from '../abort-button';
import { AutoRefresh, RefreshButton } from '../auto-refresh';
import { RelativeTime } from '../timestamp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SessionsPage(): Promise<React.ReactElement> {
  const [sessionsRes, metrics, analytics] = await Promise.all([
    loadSessions(),
    loadMetrics(),
    loadAnalytics(),
  ]);
  const recentRuns = analytics.recentFailures; // failures only; not used here
  void recentRuns;
  // Pull recent runs from metrics directly.

  return (
    <>
      <AutoRefresh />
      <main className="flex-1 w-full mx-auto px-6 py-5 2xl:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-br">
          <div>
            <h1 className="font-mono text-[var(--fs-xs)] tracking-widest text-cy uppercase mb-1">
              {'// SESSIONS'}
            </h1>
            <h2 className="text-2xl font-bold text-tx">Live and recent agents</h2>
            <p className="text-[var(--fs-xs)] text-dim mt-1 font-mono">
              {sessionsRes.sessionsFile}
              {sessionsRes.controlPort && (
                <>
                  {' '}
                  · control port :
                  <span className="text-ok">{sessionsRes.controlPort}</span>
                </>
              )}
            </p>
          </div>
          <RefreshButton />
        </header>

        <section className="mb-5">
          <h3 className="akido-section-title mb-3">
            Live ({sessionsRes.sessions.length})
          </h3>
          {sessionsRes.sessions.length === 0 ? (
            <div className="rounded-[var(--r)] border border-br bg-c1 p-6 text-center text-dim text-[var(--fs-sm)]">
              {sessionsRes.controlPort
                ? `aahp run is active on :${sessionsRes.controlPort} but live agent details are not published yet (homeofe/aahp-runner#31)`
                : 'No active sessions. Start a run from Overview.'}
            </div>
          ) : (
            <div className="space-y-2">
              {sessionsRes.sessions.map((s) => (
                <div
                  key={`${s.repoName}-${s.taskId}-${s.startedAt}`}
                  className="rounded-[var(--r)] border border-[rgba(0,232,122,0.3)] bg-[var(--ok-soft)] p-3 flex flex-wrap items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_8px_rgba(0,232,122,0.7)] animate-pulse shrink-0" />
                      <span className="font-mono text-tx font-bold">{s.repoName}</span>
                      <span className="font-mono text-[var(--fs-xs)] text-cy bg-[var(--cy-soft)] border border-[rgba(48,172,236,0.12)] rounded-[var(--r)] px-1.5">
                        {s.taskId}
                      </span>
                      <span className="font-mono text-[var(--fs-xs)] text-ok bg-[var(--ok-soft)] border border-[rgba(0,232,122,0.3)] rounded-[var(--r)] px-1.5">
                        {s.backend}
                      </span>
                    </div>
                    {s.taskTitle && (
                      <p className="text-sec text-[var(--fs-sm)] mt-1.5 truncate" title={s.taskTitle}>
                        {s.taskTitle}
                      </p>
                    )}
                    {s.lastLine && (
                      <p
                        className="font-mono text-dim text-[var(--fs-xs)] mt-1 truncate"
                        title={s.lastLine}
                      >
                        &gt; {s.lastLine}
                      </p>
                    )}
                    <p
                      className="font-mono text-dim text-[var(--fs-micro)] mt-1 truncate"
                      title={s.repoPath}
                    >
                      {s.repoPath}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[var(--fs-xs)] text-dim">
                      <RelativeTime iso={s.startedAt} />
                    </span>
                    <AbortButton
                      repoName={s.repoName}
                      taskId={s.taskId}
                      disabled={!sessionsRes.controlPort}
                      disabledReason="runner controlPort missing"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="akido-section-title mb-3">Recent runs (last 30)</h3>
          {!metrics.available ? (
            <div className="rounded-[var(--r)] border border-br bg-c1 p-6 text-center text-dim text-[var(--fs-sm)]">
              No metrics file yet.
            </div>
          ) : (
            <RecentRunsTable />
          )}
        </section>
      </main>
    </>
  );
}

async function RecentRunsTable(): Promise<React.ReactElement> {
  const { readFile } = await import('node:fs/promises');
  const { homedir } = await import('node:os');
  const { join } = await import('node:path');

  const file =
    process.env['METRICS_FILE'] ??
    join(process.env['HOME'] ?? homedir(), '.aahp', 'metrics.jsonl');

  type Row = {
    timestamp: string;
    repo: string;
    taskId: string;
    taskTitle: string;
    backend: string;
    durationMs: number;
    success: boolean;
    aborted: boolean;
    inputTokens: number;
    outputTokens: number;
  };

  let text = '';
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return (
      <div className="rounded-[var(--r)] border border-br bg-c1 p-6 text-center text-dim text-[var(--fs-sm)]">
        No metrics file yet.
      </div>
    );
  }
  const rows: Row[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Record<string, unknown>;
      if (typeof r['timestamp'] !== 'string') continue;
      rows.push({
        timestamp: r['timestamp'],
        repo: typeof r['repo'] === 'string' ? r['repo'] : '',
        taskId: typeof r['taskId'] === 'string' ? r['taskId'] : '',
        taskTitle: typeof r['taskTitle'] === 'string' ? r['taskTitle'] : '',
        backend: typeof r['backend'] === 'string' ? r['backend'] : 'unknown',
        durationMs: typeof r['durationMs'] === 'number' ? r['durationMs'] : 0,
        success: r['success'] === true,
        aborted: r['aborted'] === true,
        inputTokens: typeof r['inputTokens'] === 'number' ? r['inputTokens'] : 0,
        outputTokens: typeof r['outputTokens'] === 'number' ? r['outputTokens'] : 0,
      });
    } catch {
      // skip malformed
    }
  }
  const recent = rows.slice(-30).reverse();

  return (
    <div className="rounded-[var(--r)] border border-br bg-c1 overflow-hidden">
      <table className="w-full text-[var(--fs-xs)] font-mono">
        <thead className="bg-c2">
          <tr className="text-dim border-b border-br">
            <th className="text-left p-2">when</th>
            <th className="text-left p-2">project</th>
            <th className="text-left p-2">task</th>
            <th className="text-left p-2">backend</th>
            <th className="text-right p-2">dur</th>
            <th className="text-right p-2">tokens</th>
            <th className="text-center p-2">status</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((r) => (
            <tr key={`${r.timestamp}-${r.repo}-${r.taskId}`} className="border-b border-br/50">
              <td className="p-2 text-dim">
                <RelativeTime iso={r.timestamp} />
              </td>
              <td className="p-2 text-cy">{r.repo}</td>
              <td className="p-2 text-sec max-w-[200px] truncate" title={r.taskTitle}>
                {r.taskId} {r.taskTitle && `· ${r.taskTitle}`}
              </td>
              <td className="p-2 text-sec">{r.backend}</td>
              <td className="p-2 text-right text-sec">{formatDuration(r.durationMs)}</td>
              <td className="p-2 text-right text-sec">
                {r.inputTokens + r.outputTokens > 0
                  ? formatTokens(r.inputTokens + r.outputTokens)
                  : '-'}
              </td>
              <td className="p-2 text-center">
                {r.aborted ? (
                  <span className="text-warn">aborted</span>
                ) : r.success ? (
                  <span className="text-ok">ok</span>
                ) : (
                  <span className="text-er">fail</span>
                )}
              </td>
            </tr>
          ))}
          {recent.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-dim">
                no runs yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
