import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/[action]/route';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../cookies';

/**
 * The console's own auth routes.
 *
 * Switching organisation is the only one the API treats as authenticated, and
 * it was shipped without forwarding the access token at all — so every switch
 * came back "missing_api_key" while the API was working perfectly. Nothing in
 * the API suite could see it, because those tests send the header themselves.
 */

const call = (action: string, cookie: string, body: Record<string, unknown> = {}) =>
  POST(
    new NextRequest(`http://localhost:3000/api/auth/${action}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) },
  );

const signedIn = `${ACCESS_COOKIE}=live-access; ${REFRESH_COOKIE}=rt_live`;

const ok = (extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      ...extra,
      tokens: { access_token: 'new-access', refresh_token: 'rt_new' },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/auth/switch', () => {
  it('forwards the access token', async () => {
    const headers: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        headers.push(new Headers(init.headers).get('authorization'));
        return ok({ active_tenant_id: 't-1' });
      }),
    );

    expect((await call('switch', signedIn, { tenant_id: 't-1' })).status).toBe(200);
    expect(headers[0]).toBe('Bearer live-access');
  });

  it('supplies the refresh token the browser cannot read', async () => {
    let sent: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        return ok({ active_tenant_id: 't-1' });
      }),
    );

    await call('switch', signedIn, { tenant_id: 't-1' });
    expect(sent.refresh_token).toBe('rt_live');
  });

  it('retries with the rotated refresh token, not the spent one', async () => {
    // Switching redeems the token it is given. Replaying the original after a
    // rotation presents an already-used token, which the API reads as theft
    // and answers by revoking the whole family — signing the user out of
    // everything because their access token expired.
    const calls: { url: string; auth: string | null; refresh: unknown }[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const refresh = (JSON.parse(String(init.body)) as { refresh_token?: string }).refresh_token;
        calls.push({ url, auth: new Headers(init.headers).get('authorization'), refresh });

        if (url.includes('/v1/auth/refresh')) {
          return new Response(
            JSON.stringify({ tokens: { access_token: 'fresh', refresh_token: 'rt_rotated' } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        // The first switch fails on a stale access token.
        return calls.filter((c) => c.url.includes('switch')).length === 1
          ? new Response('{}', { status: 401 })
          : ok({ active_tenant_id: 't-1' });
      }),
    );

    expect((await call('switch', signedIn, { tenant_id: 't-1' })).status).toBe(200);

    const retry = calls.at(-1)!;
    expect(retry.auth).toBe('Bearer fresh');
    expect(retry.refresh).toBe('rt_rotated');
  });

  it('never returns tokens to the browser', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ active_tenant_id: 't-1' })));

    const body = (await (await call('switch', signedIn, { tenant_id: 't-1' })).json()) as Record<
      string,
      unknown
    >;
    expect(body.tokens).toBeUndefined();
    expect(body.active_tenant_id).toBe('t-1');
  });
});

describe('POST /api/auth/login and signup', () => {
  it('sends no access token, because a session does not exist yet', async () => {
    const headers: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        headers.push(new Headers(init.headers).get('authorization'));
        return ok();
      }),
    );

    await call('login', '', { email: 'a@b.c', password: 'x' });
    await call('signup', '', { email: 'a@b.c' });
    expect(headers).toEqual([null, null]);
  });

  it('rejects an unknown action rather than proxying it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect((await call('elevate', signedIn)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a cross-site origin', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        body: '{}',
      }),
      { params: Promise.resolve({ action: 'login' }) },
    );
    expect(response.status).toBe(403);
  });
});
