import { loadAnalytics, type DailyBucket } from '@/lib/analytics';
import { formatDuration, formatTokens } from '@/lib/metrics';
import { AutoRefresh, RefreshButton } from '../auto-refresh';
import { RelativeTime } from '../timestamp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function bar(d: DailyBucket, max: number): string {
  if (max === 0) return '0';
  const ratio = d.runs / max;
  const heights = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const idx = Math.min(heights.length - 1, Math.floor(ratio * heights.length));
  return heights[idx]!;
}

function daySparkline(daily: DailyBucket[]): React.ReactElement {
  const max = Math.max(...daily.map((d) => d.runs), 1);
  return (
    <div className="flex gap-1 items-end font-mono text-cy">
      {daily.map((d, idx) => {
        const tone = d.failures > d.successes ? 'text-er' : d.successes > 0 ? 'text-ok' : 'text-dim';
        return (
          <span
            key={`${d.date}-${idx}`}
            title={`${d.date}: ${d.runs} runs (${d.successes} ok, ${d.failures} fail, ${d.aborted} aborted, ${formatTokens(d.totalTokens)} tokens)`}
            className={`text-[16px] leading-none ${tone}`}
          >
            {bar(d, max)}
          </span>
        );
      })}
    </div>
  );
}

export default async function MetricsPage(): Promise<React.ReactElement> {
  const a = await loadAnalytics();
  const cacheTotal = a.totals.totalCacheReadTokens + a.totals.totalInputTokens;
  const cacheHitRate =
    cacheTotal > 0 ? Math.round((a.totals.totalCacheReadTokens / cacheTotal) * 100) : 0;

  return (
    <>
      <AutoRefresh />
      <main className="flex-1 w-full mx-auto px-6 py-5 2xl:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-br">
          <div>
            <h1 className="font-mono text-[var(--fs-xs)] tracking-widest text-cy uppercase mb-1">
              {'// METRICS'}
            </h1>
            <h2 className="text-2xl font-bold text-tx">Runner activity</h2>
            <p className="text-[var(--fs-xs)] text-dim mt-1 font-mono">{a.metricsFile}</p>
          </div>
          <RefreshButton />
        </header>

        {!a.available ? (
          <div className="rounded-[var(--r)] border border-br bg-c1 p-8 text-center">
            <h2 className="text-[var(--fs-lg)] font-semibold text-tx mb-2">
              No metrics yet
            </h2>
            <p className="text-dim text-[var(--fs-sm)]">
              {a.error ? (
                <>error reading metrics: {a.error}</>
              ) : (
                <>
                  No <code className="font-mono text-cy">{a.metricsFile}</code>. Run{' '}
                  <code className="font-mono text-cy">aahp run</code> at least once.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Top totals strip */}
            <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
              <Tile label="total runs" value={String(a.totals.runs)} />
              <Tile
                label="success"
                value={`${a.totals.runs > 0 ? Math.round((a.totals.successes / a.totals.runs) * 100) : 0}%`}
                tone="ok"
              />
              <Tile
                label="failures"
                value={String(a.totals.failures)}
                tone={a.totals.failures > 0 ? 'warn' : 'neutral'}
              />
              <Tile
                label="aborted"
                value={String(a.totals.aborted)}
                tone={a.totals.aborted > 0 ? 'er' : 'neutral'}
              />
              <Tile
                label="tokens i/o"
                value={`${formatTokens(a.totals.totalInputTokens)} / ${formatTokens(a.totals.totalOutputTokens)}`}
              />
              <Tile
                label="cache hit"
                value={`${cacheHitRate}%`}
                tone={cacheHitRate >= 60 ? 'ok' : cacheHitRate >= 30 ? 'warn' : 'neutral'}
              />
            </section>

            {/* Daily activity */}
            <section className="rounded-[var(--r)] border border-br bg-c1 p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="akido-section-title">Last 14 days</h3>
                <span className="text-[var(--fs-xs)] text-dim font-mono">
                  total {a.daily.reduce((s, d) => s + d.runs, 0)} runs
                </span>
              </div>
              {daySparkline(a.daily)}
              <div className="flex justify-between mt-1 font-mono text-[var(--fs-micro)] text-dim">
                <span>{a.daily[0]?.date}</span>
                <span>{a.daily[a.daily.length - 1]?.date}</span>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Per-backend */}
              <section className="rounded-[var(--r)] border border-br bg-c1 p-4">
                <h3 className="akido-section-title mb-3">By backend</h3>
                <table className="w-full text-[var(--fs-xs)] font-mono">
                  <thead>
                    <tr className="text-dim border-b border-br">
                      <th className="text-left pb-1.5">backend</th>
                      <th className="text-right">runs</th>
                      <th className="text-right">success</th>
                      <th className="text-right">avg</th>
                      <th className="text-right">tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.byBackend.map((b, idx) => (
                      <tr key={`${b.backend}-${idx}`} className="border-b border-br/50">
                        <td className="py-1.5 text-cy">{b.backend}</td>
                        <td className="py-1.5 text-right text-sec">{b.runs}</td>
                        <td
                          className={`py-1.5 text-right ${
                            b.successRate >= 80
                              ? 'text-ok'
                              : b.successRate >= 50
                                ? 'text-warn'
                                : 'text-er'
                          }`}
                        >
                          {b.successRate}%
                        </td>
                        <td className="py-1.5 text-right text-sec">
                          {formatDuration(b.avgDurationMs)}
                        </td>
                        <td className="py-1.5 text-right text-sec">
                          {formatTokens(b.totalTokens)}
                        </td>
                      </tr>
                    ))}
                    {a.byBackend.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-dim">
                          no data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              {/* Per-model */}
              <section className="rounded-[var(--r)] border border-br bg-c1 p-4">
                <h3 className="akido-section-title mb-3">By model</h3>
                <table className="w-full text-[var(--fs-xs)] font-mono">
                  <thead>
                    <tr className="text-dim border-b border-br">
                      <th className="text-left pb-1.5">model</th>
                      <th className="text-right">runs</th>
                      <th className="text-right">in / out</th>
                      <th className="text-right">cache</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.byModel.map((m, idx) => (
                      <tr key={`${m.modelId}-${idx}`} className="border-b border-br/50">
                        <td
                          className="py-1.5 text-cy max-w-[180px] truncate"
                          title={m.modelId}
                        >
                          {m.modelId}
                        </td>
                        <td className="py-1.5 text-right text-sec">{m.runs}</td>
                        <td className="py-1.5 text-right text-sec">
                          {formatTokens(m.totalInputTokens)} /{' '}
                          {formatTokens(m.totalOutputTokens)}
                        </td>
                        <td
                          className={`py-1.5 text-right ${
                            m.cacheHitRate >= 60
                              ? 'text-ok'
                              : m.cacheHitRate >= 30
                                ? 'text-warn'
                                : 'text-dim'
                          }`}
                        >
                          {m.cacheHitRate}%
                        </td>
                      </tr>
                    ))}
                    {a.byModel.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-dim">
                          no model data recorded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              {/* Top by cost */}
              <section className="rounded-[var(--r)] border border-br bg-c1 p-4">
                <h3 className="akido-section-title mb-3">Top projects by token spend</h3>
                <table className="w-full text-[var(--fs-xs)] font-mono">
                  <thead>
                    <tr className="text-dim border-b border-br">
                      <th className="text-left pb-1.5">project</th>
                      <th className="text-right">runs</th>
                      <th className="text-right">tokens</th>
                      <th className="text-right">success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.topByCost.map((p, idx) => (
                      <tr key={`${p.repo}-${idx}`} className="border-b border-br/50">
                        <td className="py-1.5 text-cy max-w-[180px] truncate" title={p.repo}>
                          {p.repo}
                        </td>
                        <td className="py-1.5 text-right text-sec">{p.runs}</td>
                        <td className="py-1.5 text-right text-sec">
                          {formatTokens(p.totalTokens)}
                        </td>
                        <td
                          className={`py-1.5 text-right ${
                            p.successRate >= 80
                              ? 'text-ok'
                              : p.successRate >= 50
                                ? 'text-warn'
                                : 'text-er'
                          }`}
                        >
                          {p.successRate}%
                        </td>
                      </tr>
                    ))}
                    {a.topByCost.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-dim">
                          no token data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              {/* Recent failures */}
              <section className="rounded-[var(--r)] border border-br bg-c1 p-4">
                <h3 className="akido-section-title mb-3">Recent failures</h3>
                <ul className="space-y-1.5 text-[var(--fs-xs)] font-mono">
                  {a.recentFailures.map((f, idx) => (
                    <li
                      key={`${f.timestamp}-${f.repo}-${f.taskId}-${idx}`}
                      className="flex items-center gap-2 min-w-0"
                    >
                      <span className={f.aborted ? 'text-warn' : 'text-er'}>
                        {f.aborted ? '×' : '✗'}
                      </span>
                      <span className="text-cy">{f.repo}</span>
                      <span className="text-dim">·</span>
                      <span className="text-sec">{f.taskId}</span>
                      <span className="text-dim">·</span>
                      <span className="text-sec truncate flex-1" title={f.taskTitle}>
                        {f.taskTitle || '-'}
                      </span>
                      <span className="text-dim shrink-0">
                        <RelativeTime iso={f.timestamp} />
                      </span>
                    </li>
                  ))}
                  {a.recentFailures.length === 0 && (
                    <li className="text-center text-dim py-3">
                      no failures recorded
                    </li>
                  )}
                </ul>
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Tile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'er' | 'neutral';
}): React.ReactElement {
  const cls =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'er'
          ? 'text-er'
          : 'text-tx';
  return (
    <div className="rounded-[var(--r)] border border-br bg-c1 px-4 py-3">
      <div className="text-dim text-[var(--fs-micro)] uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`font-mono text-[var(--fs-lg)] font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
