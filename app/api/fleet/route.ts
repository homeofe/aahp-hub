import { buildFleetOverview, type FleetProjectInput } from '@/lib/fleet';
import { scanProjects } from '@/lib/manifest';

/**
 * Repository and checkout state for every scanned project.
 *
 * This route is intentionally separate from the page render: the handoff view
 * paints immediately from local files, and these columns arrive afterwards.
 *
 * Credentials: the GitHub half of this response comes from the `gh` CLI, which
 * supplies its own stored credentials. The hub reads no token and defines no
 * token environment variable.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const force = new URL(request.url).searchParams.get('refresh') === '1';
    const scan = await scanProjects();
    const projects: FleetProjectInput[] = scan.projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      remote: project.remote,
      handoffModifiedAt: project.handoffModifiedAt,
    }));

    const overview = await buildFleetOverview(projects, { force });
    return jsonResponse(200, overview);
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
