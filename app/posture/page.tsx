import { loadEstatePosture } from '@/lib/posture';
import { redactHome } from '@/lib/redact';
import { AutoRefresh, RefreshButton } from '../auto-refresh';
import { RelativeTime } from '../timestamp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PosturePage(): Promise<React.ReactElement> {
  const posture = await loadEstatePosture();
  const { summary, repos, scannedAt } = posture;

  return (
    <>
      <AutoRefresh />
      <main className="flex-1 w-full mx-auto px-6 py-5 2xl:px-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-br">
          <div>
            <h1 className="font-mono text-[var(--fs-xs)] tracking-widest text-cy uppercase mb-1">
              {'// SECURITY & POSTURE'}
            </h1>
            <h2 className="text-2xl font-bold text-tx">Estate Dependency Posture</h2>
            <p className="text-[var(--fs-xs)] text-dim mt-1 font-mono flex items-center gap-2">
              <span>Updated <RelativeTime iso={scannedAt} /></span>
              <span>·</span>
              <span>Read-only compliance & vulnerability tracking</span>
            </p>
          </div>
          <RefreshButton />
        </header>

        {/* Top Summary Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <SummaryCard label="Total Repos" value={String(summary.totalRepos)} />
          <SummaryCard
            label="Healthy"
            value={String(summary.healthyCount)}
            tone={summary.healthyCount === summary.totalRepos ? 'ok' : 'cy'}
          />
          <SummaryCard
            label="Stale / Outdated"
            value={String(summary.staleCount)}
            tone={summary.staleCount > 0 ? 'warn' : 'neutral'}
          />
          <SummaryCard
            label="Vulnerable"
            value={String(summary.vulnerableCount)}
            tone={summary.vulnerableCount > 0 ? 'er' : 'neutral'}
          />
          <SummaryCard
            label="Critical Advisories"
            value={String(summary.totalCriticalAdvisories)}
            tone={summary.totalCriticalAdvisories > 0 ? 'er' : 'neutral'}
          />
          <SummaryCard
            label="Missing Access"
            value={String(summary.missingPermissionsCount)}
            tone={summary.missingPermissionsCount > 0 ? 'warn' : 'neutral'}
          />
        </section>

        {/* Permissions & Refresh Cadence Guidance Box */}
        <section className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-4 font-mono text-[var(--fs-xs)] space-y-2">
          <h3 className="akido-section-title text-cy">Required GitHub Permissions & Refresh Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sec">
            <div>
              <p className="text-tx font-bold mb-1">Required Permissions (Read-Only):</p>
              <ul className="list-disc list-inside space-y-0.5 text-dim">
                <li><code className="text-cy">contents: read</code> - Read workflow configs & dependency manifests</li>
                <li><code className="text-cy">security-events: read</code> - Read Dependabot & CodeQL security alerts</li>
                <li><code className="text-cy">actions: read</code> - Verify Supply Chain Guard execution status</li>
              </ul>
            </div>
            <div>
              <p className="text-tx font-bold mb-1">Update Cadence & Enforcement:</p>
              <p className="text-dim">
                Supply Chain Guard runs on push & weekly cron (<code className="text-cy">0 6 * * 1</code>). Data collection is strictly read-only; no automated commits or deployments occur without review.
              </p>
            </div>
          </div>
        </section>

        {/* Detailed Per-Repository Drill-down Table */}
        <section className="rounded-[var(--r)] border border-br bg-[var(--c1)] p-4">
          <h3 className="akido-section-title mb-3">Repository Posture Drill-down</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[var(--fs-xs)]">
              <thead>
                <tr className="text-dim uppercase border-b border-br text-[var(--fs-micro)]">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Repository</th>
                  <th className="py-2.5 px-3">Ecosystem</th>
                  <th className="py-2.5 px-3">Supply Chain Guard</th>
                  <th className="py-2.5 px-3">Container Scan</th>
                  <th className="py-2.5 px-3 text-right">Advisories (Crit/High)</th>
                  <th className="py-2.5 px-3 text-right">Permissions</th>
                  <th className="py-2.5 px-3 text-right">Last Scan</th>
                </tr>
              </thead>
              <tbody>
                {repos.map((r) => {
                  const isHealthy = !r.isStale && r.permissions.hasAccess && r.openAdvisories.total === 0 && r.supplyChainGuard.status === 'passed';
                  const ghUrl = r.githubRepo ? `https://github.com/${r.githubRepo}` : null;

                  return (
                    <tr key={r.path} className="border-b border-br/50 hover:bg-[var(--c2)] transition-colors">
                      {/* Health Indicator */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r)] ${
                            isHealthy
                              ? 'bg-[var(--ok-soft)] text-ok border border-[rgba(0,232,122,0.3)]'
                              : r.openAdvisories.total > 0 || r.supplyChainGuard.status === 'failed'
                                ? 'bg-[var(--er-soft)] text-er border border-[rgba(255,64,96,0.3)]'
                                : 'bg-[var(--warn-soft)] text-warn border border-[rgba(255,187,0,0.3)]'
                          }`}
                        >
                          {isHealthy ? '✓ HEALTHY' : r.openAdvisories.total > 0 ? '× VULNERABLE' : '⚠ STALE'}
                        </span>
                      </td>

                      {/* Repo Name */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-bold text-tx">
                        {ghUrl ? (
                          <a
                            href={ghUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-cy"
                            title={redactHome(r.path)}
                          >
                            {r.repoName} ↗
                          </a>
                        ) : (
                          <span title={redactHome(r.path)}>{r.repoName}</span>
                        )}
                      </td>

                      {/* Ecosystem */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="akido-chip">{r.ecosystem}</span>
                      </td>

                      {/* Supply Chain Guard */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={
                            r.supplyChainGuard.status === 'passed'
                              ? 'text-ok font-bold'
                              : r.supplyChainGuard.status === 'failed'
                                ? 'text-er font-bold'
                                : r.supplyChainGuard.status === 'stale'
                                  ? 'text-warn'
                                  : 'text-dim'
                          }
                        >
                          {r.supplyChainGuard.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Container Scan */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {r.containerScan ? (
                          <span
                            className={
                              r.containerScan.status === 'passed'
                                ? 'text-ok'
                                : r.containerScan.status === 'failed'
                                  ? 'text-er font-bold'
                                  : 'text-dim'
                            }
                          >
                            {r.containerScan.status}
                          </span>
                        ) : (
                          <span className="text-dim">N/A</span>
                        )}
                      </td>

                      {/* Open Advisories */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {r.openAdvisories.total > 0 ? (
                          <span className="text-er font-bold">
                            {r.openAdvisories.critical} crit / {r.openAdvisories.high} high
                          </span>
                        ) : (
                          <span className="text-ok">0 open</span>
                        )}
                      </td>

                      {/* Permissions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {r.permissions.hasAccess ? (
                          <span className="text-ok">Access OK</span>
                        ) : (
                          <span className="text-warn" title={r.permissions.missingPermissions.join(', ')}>
                            Missing Permission
                          </span>
                        )}
                      </td>

                      {/* Last Scan / Stale Reason */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap text-dim" title={r.staleReason}>
                        {r.lastDependencyScan ? <RelativeTime iso={r.lastDependencyScan} /> : 'never'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'cy' | 'warn' | 'er' | 'neutral';
}): React.ReactElement {
  const cls =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'cy'
        ? 'text-cy'
        : tone === 'warn'
          ? 'text-warn'
          : tone === 'er'
            ? 'text-er'
            : 'text-tx';

  return (
    <div className="rounded-[var(--r)] border border-br bg-[var(--c1)] px-4 py-3">
      <div className="text-dim text-[var(--fs-micro)] uppercase tracking-wider mb-0.5 font-mono">{label}</div>
      <div className={`font-mono text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
