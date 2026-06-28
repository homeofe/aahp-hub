import { watchTargets } from '@/lib/sessions';
import { redactHome } from '@/lib/redact';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const initial = await watchTargets();
      const lastMtimes = new Map<string, number | null>();
      for (const t of initial) {
        lastMtimes.set(t.path, t.mtimeMs);
      }
      // Emit home-redacted paths so the stream never leaks the OS username or
      // home-directory layout; the internal Map still keys on the real path.
      send('hello', {
        at: new Date().toISOString(),
        targets: initial.map((t) => ({ ...t, path: redactHome(t.path) })),
      });

      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const targets = await watchTargets();
          for (const t of targets) {
            const prev = lastMtimes.get(t.path);
            if (prev !== t.mtimeMs) {
              lastMtimes.set(t.path, t.mtimeMs);
              if (prev !== undefined) {
                send('change', { path: redactHome(t.path), mtimeMs: t.mtimeMs, at: new Date().toISOString() });
              }
            }
          }
        } catch {
          // best-effort polling
        }
      }, POLL_INTERVAL_MS);

      const heartbeatTimer = setInterval(() => {
        if (closed) return;
        send('heartbeat', { at: new Date().toISOString() });
      }, HEARTBEAT_INTERVAL_MS);

      const cleanup = (): void => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
