import { describe, it, expect, afterEach } from 'vitest';
import { guardMutation } from './guard.js';

const SELF = 'http://localhost:3000/api/run';

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request(SELF, { method: 'POST', headers });
}

afterEach(() => {
  delete process.env['AAHP_HUB_TOKEN'];
});

describe('guardMutation', () => {
  it('allows a request with no Origin and no token configured', () => {
    expect(guardMutation(makeReq())).toBeNull();
  });

  it('allows a same-origin request (Origin host matches self host)', () => {
    expect(guardMutation(makeReq({ origin: 'http://localhost:3000' }))).toBeNull();
  });

  it('rejects a cross-origin request with 403', () => {
    const res = guardMutation(makeReq({ origin: 'http://evil.example' }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('rejects when a token is required but missing (401)', () => {
    process.env['AAHP_HUB_TOKEN'] = 's3cret';
    expect(guardMutation(makeReq())!.status).toBe(401);
  });

  it('rejects a wrong token (401)', () => {
    process.env['AAHP_HUB_TOKEN'] = 's3cret';
    expect(guardMutation(makeReq({ 'x-aahp-token': 'nope' }))!.status).toBe(401);
  });

  it('allows a correct x-aahp-token', () => {
    process.env['AAHP_HUB_TOKEN'] = 's3cret';
    expect(guardMutation(makeReq({ 'x-aahp-token': 's3cret' }))).toBeNull();
  });

  it('allows a correct Bearer token', () => {
    process.env['AAHP_HUB_TOKEN'] = 's3cret';
    expect(guardMutation(makeReq({ authorization: 'Bearer s3cret' }))).toBeNull();
  });

  it('enforces the cross-origin check before the token', () => {
    process.env['AAHP_HUB_TOKEN'] = 's3cret';
    const res = guardMutation(
      makeReq({ origin: 'http://evil.example', 'x-aahp-token': 's3cret' }),
    );
    expect(res!.status).toBe(403);
  });
});
