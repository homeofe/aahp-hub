import { readControlPort } from '@/lib/sessions';
import { guardMutation } from '@/lib/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AbortBody {
  repoName?: unknown;
  taskId?: unknown;
}

const REQUEST_TIMEOUT_MS = 8000;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const denied = guardMutation(req);
  if (denied) return denied;

  let body: AbortBody;
  try {
    body = (await req.json()) as AbortBody;
  } catch {
    return jsonResponse(400, { error: 'invalid JSON body' });
  }

  if (typeof body.repoName !== 'string' || typeof body.taskId !== 'string') {
    return jsonResponse(400, { error: 'repoName and taskId are required' });
  }

  const port = await readControlPort();
  if (!port) {
    return jsonResponse(503, {
      error: 'runner control port is not available',
      hint: 'is `aahp run` active and writing controlPort into ~/.aahp/sessions.json?',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(`http://127.0.0.1:${port}/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoName: body.repoName, taskId: body.taskId }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return jsonResponse(502, {
      error: 'failed to reach runner control endpoint',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
  clearTimeout(timer);

  const text = await upstream.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  return jsonResponse(upstream.status, payload);
}

export function GET(): Response {
  return jsonResponse(405, { error: 'method not allowed' });
}
