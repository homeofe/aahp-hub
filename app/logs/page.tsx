import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AutoRefresh, RefreshButton } from '../auto-refresh';
import { RelativeTime } from '../timestamp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LogFile {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

async function listLogs(): Promise<{ logs: LogFile[]; dir: string; error: string | null }> {
  const dir = join(process.env['HOME'] ?? homedir(), '.aahp', 'logs');
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const logs: LogFile[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      try {
        const path = join(dir, entry.name);
        const s = await stat(path);
        logs.push({
          name: entry.name,
          path,
          sizeBytes: s.size,
          modifiedAt: s.mtime.toISOString(),
        });
      } catch {
        // skip
      }
    }
    logs.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return { logs, dir, error: null };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { logs: [], dir, error: null };
    return { logs: [], dir, error: err instanceof Error ? err.message : String(err) };
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function LogsPage(): Promise<React.ReactElement> {
  const result = await listLogs();
  return (
    <>
      <AutoRefresh />
      <main className="flex-1 w-full mx-auto px-6 py-5 2xl:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-br">
          <div>
            <h1 className="font-mono text-[var(--fs-xs)] tracking-widest text-cy uppercase mb-1">
              {'// LOGS'}
            </h1>
            <h2 className="text-2xl font-bold text-tx">Agent log files</h2>
            <p className="text-[var(--fs-xs)] text-dim mt-1 font-mono">{result.dir}</p>
          </div>
          <RefreshButton />
        </header>

        {result.error ? (
          <div className="rounded-[var(--r)] border border-[rgba(255,64,96,0.4)] bg-[var(--er-soft)] p-4 text-er font-mono text-[var(--fs-sm)]">
            {result.error}
          </div>
        ) : result.logs.length === 0 ? (
          <div className="rounded-[var(--r)] border border-br bg-c1 p-6 text-center text-dim text-[var(--fs-sm)]">
            No logs in <code className="font-mono text-cy">{result.dir}</code> yet. The
            runner writes per-agent log files here when it spawns.
          </div>
        ) : (
          <div className="rounded-[var(--r)] border border-br bg-c1 overflow-hidden">
            <table className="w-full text-[var(--fs-xs)] font-mono">
              <thead className="bg-c2">
                <tr className="text-dim border-b border-br">
                  <th className="text-left p-2">file</th>
                  <th className="text-right p-2">size</th>
                  <th className="text-right p-2">modified</th>
                </tr>
              </thead>
              <tbody>
                {result.logs.map((log) => (
                  <tr key={log.path} className="border-b border-br/50">
                    <td className="p-2 text-cy" title={log.path}>
                      {log.name}
                    </td>
                    <td className="p-2 text-right text-sec">{formatBytes(log.sizeBytes)}</td>
                    <td className="p-2 text-right text-dim">
                      <RelativeTime iso={log.modifiedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[var(--fs-xs)] text-dim font-mono">
          tip: <code className="text-sec">aahp logs &lt;repo&gt;</code> tails the live log
          for a project from the CLI
        </p>
      </main>
    </>
  );
}
