import { scanProjects } from '@/lib/manifest';
import { redactHome } from '@/lib/redact';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(): Promise<Response> {
  try {
    const scan = await scanProjects();
    const projects = scan.projects.map((p) => ({
      id: p.id,
      name: p.name,
      path: redactHome(p.path),
      phase: p.phase,
      readyTasks: p.readyTasks,
      inProgressTasks: p.inProgressTasks,
      doneTasks: p.doneTasks,
      totalTasks: p.totalTasks,
      isRunning: p.activeSessions.length > 0,
      recentlyActive: p.recentlyActive,
      // The git origin remote wins over the manifest declaration: directory
      // names and manifest fields both drift, remotes do not.
      githubRepo: p.remote.repo ?? p.githubRepo,
      remoteKind: p.remote.kind,
      remoteHost: p.remote.host,
      handoffModifiedAt: p.handoffModifiedAt,
      worktreeCount: p.worktreeCount,
    }));

    return jsonResponse(200, {
      projects,
      total: projects.length,
      scannedAt: scan.scannedAt,
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
