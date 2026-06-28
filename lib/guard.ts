import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Access-control gate for the state-changing routes (/api/run, /api/abort).
 *
 * Two layers, both independent of the network binding (which should also be
 * loopback-only in production):
 *
 *   1. Same-origin (CSRF): a browser request whose Origin host does not match
 *      the request's own host is rejected. This stops a malicious page from
 *      driving the hub through the victim's browser. Non-browser clients send
 *      no Origin and pass this layer, relying on the loopback bind and the
 *      optional token below.
 *
 *   2. Optional shared secret: when AAHP_HUB_TOKEN is set, every mutating
 *      request must present it (header `x-aahp-token` or `Authorization:
 *      Bearer <token>`), compared in constant time. It is off by default so the
 *      bundled UI keeps working token-free on a local machine; enable it for
 *      headless / scripted API clients or shared hosts.
 *
 * Returns a rejection Response, or null when the request may proceed.
 */
export function guardMutation(req: Request): Response | null {
  const origin = req.headers.get('origin');
  if (origin) {
    const originHost = hostOf(origin);
    // Prefer the request URL's host (reliable in the Next.js App Router and not
    // a forbidden header); fall back to the Host header.
    const selfHost = hostOf(req.url) ?? req.headers.get('host');
    if (!originHost || !selfHost || originHost !== selfHost) {
      return deny(403, 'cross-origin request rejected');
    }
  }

  const expected = (process.env['AAHP_HUB_TOKEN'] ?? '').trim();
  if (expected.length > 0) {
    const provided = readToken(req);
    if (!provided || !safeEqual(provided, expected)) {
      return deny(401, 'missing or invalid token');
    }
  }

  return null;
}

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function readToken(req: Request): string | null {
  const direct = req.headers.get('x-aahp-token');
  if (direct && direct.length > 0) return direct;
  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice('Bearer '.length).trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  // Compare fixed-length SHA-256 digests so the comparison is constant-time and
  // leaks neither content nor the length of the configured token.
  const ah = createHash('sha256').update(a, 'utf8').digest();
  const bh = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ah, bh);
}
