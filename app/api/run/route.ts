import { spawnRun, type SpawnRunArgs } from '@/lib/runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RunBody {
  project?: unknown;
  all?: unknown;
  backend?: unknown;
  model?: unknown;
  timeoutMinutes?: unknown;
  dryRun?: unknown;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function pickBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function pickInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

export async function POST(req: Request): Promise<Response> {
  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
  } catch {
    return jsonResponse(400, { error: 'invalid JSON body' });
  }

  const all = pickBool(body.all) ?? false;
  const project = pickString(body.project);

  if (!all && !project) {
    return jsonResponse(400, {
      error: 'either "project" (string) or "all" (true) is required',
    });
  }
  if (all && project) {
    return jsonResponse(400, {
      error: 'pass either "project" or "all", not both',
    });
  }

  const args: SpawnRunArgs = {
    all,
    project,
    backend: pickString(body.backend),
    model: pickString(body.model),
    timeoutMinutes: pickInt(body.timeoutMinutes),
    dryRun: pickBool(body.dryRun) ?? false,
  };

  const result = spawnRun(args);
  if (!result.ok) {
    const status = result.error?.includes('not available') ? 503 : 400;
    return jsonResponse(status, {
      error: result.error,
      command: result.command,
    });
  }

  return jsonResponse(202, {
    started: true,
    pid: result.pid,
    command: result.command,
    note: 'aahp run was spawned detached; tail ~/.aahp/logs/ for output and watch sessions.json for live status',
  });
}

export function GET(): Response {
  return jsonResponse(405, { error: 'method not allowed' });
}
