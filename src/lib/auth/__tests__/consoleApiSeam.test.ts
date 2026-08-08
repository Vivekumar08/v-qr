import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as proxyGet, POST as proxyPost } from '@/app/api/proxy/[...path]/route';
import { POST as authPost } from '@/app/api/auth/[action]/route';
import { GET as callbackGet } from '@/app/auth/callback/route';
import { createApiStub, type ApiStub } from '@/tests/apiStub';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../cookies';

/**
 * Every path the console takes to the API, against a stub that enforces the
 * contract instead of agreeing with the caller.
 *
 * Three production bugs lived here — the proxy demanding a session for
 * password reset and Google sign-in, the OAuth callback unable to set cookies
 * because it was a page, and switching organisation sending no Authorization
 * header at all. Each was invisible to both existing suites. These are the
 * tests that would have caught them.
 */

let api: ApiStub;
const SIGNED_IN = `${ACCESS_COOKIE}=live-access; ${REFRESH_COOKIE}=rt_live`;

beforeEach(() => {
  api = createApiStub();
  api.install();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const viaProxy = (
  segments: string[],
  options: { cookie?: string; method?: 'GET' | 'POST'; body?: unknown } = {},
) => {
  const method = options.method ?? 'GET';
  const request = new NextRequest(`http://localhost:3000/api/proxy/${segments.join('/')}`, {
    method,
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
    },
    ...(method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}),
  });

  const handler = method === 'POST' ? proxyPost : proxyGet;
  return handler(request, { params: Promise.resolve({ path: segments }) });
};

describe('signed-out flows reach the API', () => {
  // Bug 1: all four returned 401 from the proxy before reaching the API.
  it.each([
    [['v1', 'auth', 'password', 'forgot'], 'POST'],
    [['v1', 'auth', 'password', 'reset'], 'POST'],
    [['v1', 'auth', 'email', 'verify'], 'POST'],
    [['v1', 'auth', 'google', 'start'], 'GET'],
  ] as const)('%s needs no session', async (segments, method) => {
    const response = await viaProxy([...segments], { method });

    expect(response.status).toBe(200);
    expect(api.calls.at(-1)?.path).toBe(`/${segments.join('/')}`);
  });

  it('still refuses everything else without a session', async () => {
    for (const segments of [['v1', 'auth', 'me'], ['v1', 'codes'], ['v1', 'members']]) {
      expect((await viaProxy(segments)).status, segments.join('/')).toBe(401);
    }
    expect(api.calls).toHaveLength(0);
  });
});

describe('signed-in flows carry the credential', () => {
  it.each([
    [['v1', 'auth', 'me']],
    [['v1', 'codes']],
    [['v1', 'members']],
    [['v1', 'invites']],
    [['v1', 'api-keys']],
  ])('%s forwards the access token', async (segments) => {
    const response = await viaProxy(segments, { cookie: SIGNED_IN });

    expect(response.status).toBe(200);
    expect(api.calls.at(-1)?.authorization).toBe('Bearer live-access');
  });

  it('forwards it on writes too', async () => {
    await viaProxy(['v1', 'tenants'], {
      cookie: SIGNED_IN,
      method: 'POST',
      body: { slug: 'x', org_name: 'X' },
    });
    expect(api.calls.at(-1)?.authorization).toBe('Bearer live-access');
  });

  it('reaches a path-parameter route', async () => {
    await viaProxy(['v1', 'codes', 'abc-123', 'destinations'], { cookie: SIGNED_IN });
    expect(api.calls.at(-1)?.authorization).toBe('Bearer live-access');
  });
});

describe('the auth routes', () => {
  const callAuth = (action: string, cookie: string, body: Record<string, unknown> = {}) =>
    authPost(
      new NextRequest(`http://localhost:3000/api/auth/${action}`, {
        method: 'POST',
        headers: { cookie, origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ action }) },
    );

  // Bug 3: switch sent no Authorization header, so the API refused it while
  // working perfectly for anyone who sent one.
  it('switch forwards the access token', async () => {
    const response = await callAuth('switch', SIGNED_IN, { tenant_id: 't-1' });

    expect(response.status).toBe(200);
    expect(api.calls.at(-1)?.authorization).toBe('Bearer live-access');
    expect(api.calls.at(-1)?.body.refresh_token).toBe('rt_live');
  });

  it('login and signup send none, because a session does not exist yet', async () => {
    await callAuth('login', '', { email: 'a@b.c', password: 'x' });
    await callAuth('signup', '', { email: 'a@b.c' });
    expect(api.calls.map((c) => c.authorization)).toEqual([null, null]);
  });

  it('every session-minting action stores cookies and returns none', async () => {
    for (const action of ['login', 'signup', 'switch']) {
      const response = await callAuth(action, SIGNED_IN, { tenant_id: 't-1' });
      const cookies = response.headers.get('set-cookie') ?? '';

      expect(cookies, action).toContain(ACCESS_COOKIE);
      expect(cookies, action).toContain(REFRESH_COOKIE);
      expect(await response.json(), action).not.toHaveProperty('tokens');
    }
  });
});

describe('the Google callback', () => {
  // Bug 2: this was a page, and a Server Component cannot set cookies — so it
  // consumed the one-time code and then threw.
  it('exchanges the code and stores the session', async () => {
    const response = await callbackGet(
      new NextRequest('http://localhost:3000/auth/callback?code=otc_valid'),
    );

    expect(response.status).toBe(307);
    expect(api.calls.at(-1)?.path).toBe('/v1/auth/session/exchange');

    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain(ACCESS_COOKIE);
    expect(cookies).toContain(REFRESH_COOKIE);
  });

  it('sends a user with no organisation to onboarding', async () => {
    const response = await callbackGet(
      new NextRequest('http://localhost:3000/auth/callback?code=otc_valid'),
    );
    expect(response.headers.get('location')).toContain('/onboarding');
  });

  it('sends a user who has one straight to their codes', async () => {
    api.reply('/v1/auth/session/exchange', {
      status: 200,
      body: {
        tokens: { access_token: 'a', refresh_token: 'rt_b' },
        active_tenant_id: 'tenant-1',
      },
    });

    const response = await callbackGet(
      new NextRequest('http://localhost:3000/auth/callback?code=otc_valid'),
    );
    expect(response.headers.get('location')).toContain('/codes');
  });

  it('returns to login when the code is spent, without setting cookies', async () => {
    api.reply('/v1/auth/session/exchange', { status: 400, body: { error: { code: 'x' } } });

    const response = await callbackGet(
      new NextRequest('http://localhost:3000/auth/callback?code=otc_spent'),
    );

    expect(response.headers.get('location')).toContain('error=oauth_expired');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
