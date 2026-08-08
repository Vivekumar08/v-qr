import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/proxy/[...path]/route';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../cookies';

/**
 * The refresh-and-retry path.
 *
 * Worth testing on its own because both failure modes are quiet: a loop here
 * becomes a request storm from every open tab, and failing to persist the
 * rotated token makes the *next* request a replay, which the API's reuse
 * detection reads as theft and answers by revoking the whole family.
 */

const call = (cookie: string) =>
  GET(new NextRequest('http://localhost:3000/api/proxy/v1/codes', { headers: { cookie } }), {
    params: Promise.resolve({ path: ['v1', 'codes'] }),
  });

const signedIn = `${ACCESS_COOKIE}=stale-access; ${REFRESH_COOKIE}=live-refresh`;

const refreshResponse = () =>
  new Response(JSON.stringify({ tokens: { access_token: 'fresh', refresh_token: 'rotated' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proxy refresh', () => {
  it('refreshes once and retries once on a 401', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes('/v1/auth/refresh')) return refreshResponse();
        return new Response('{}', { status: calls.length === 1 ? 401 : 200 });
      }),
    );

    const response = await call(signedIn);

    expect(response.status).toBe(200);
    expect(calls.filter((url) => url.includes('/v1/auth/refresh'))).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  it('writes the rotated refresh token back to the cookie', async () => {
    let seen = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/v1/auth/refresh')
          ? refreshResponse()
          : new Response('{}', { status: seen++ === 0 ? 401 : 200 }),
      ),
    );

    const cookies = (await call(signedIn)).headers.get('set-cookie') ?? '';

    expect(cookies).toContain('rotated');
    expect(cookies).toContain('fresh');
  });

  it('gives up after one failed refresh rather than looping', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return new Response('{}', { status: 401 });
      }),
    );

    const response = await call(signedIn);

    expect(response.status).toBe(401);
    // One attempt, one refresh, and no more.
    expect(calls).toHaveLength(2);
  });

  it('clears the cookies when the session is genuinely over', async () => {
    // Otherwise the browser keeps presenting a dead refresh token on every
    // navigation, forever.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    expect((await call(signedIn)).headers.get('set-cookie') ?? '').toContain('Max-Age=0');
  });

  it('does not call the API at all without cookies', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect((await call('')).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the doomed first attempt when only a refresh token survives', async () => {
    // The access cookie expires from the browser's view long before the
    // session does. Sending a request with no token would spend a round trip
    // being told what we already know.
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return url.includes('/v1/auth/refresh')
          ? refreshResponse()
          : new Response('{}', { status: 200 });
      }),
    );

    const response = await call(`${REFRESH_COOKIE}=live-refresh`);

    expect(response.status).toBe(200);
    expect(calls[0]).toContain('/v1/auth/refresh');
    expect(calls).toHaveLength(2);
  });
});

/**
 * Paths reachable without a session.
 *
 * These exist because the proxy once demanded a credential for every request,
 * which made password reset, email verification and Google sign-in unreachable
 * from the console while all three worked when called directly. Nothing in the
 * unit or API suites could see it: one mocks fetch, the other skips the proxy.
 */
describe('unauthenticated paths', () => {
  const callPath = (segments: string[], cookie = '') =>
    GET(
      new NextRequest(`http://localhost:3000/api/proxy/${segments.join('/')}`, {
        headers: cookie === '' ? {} : { cookie },
      }),
      { params: Promise.resolve({ path: segments }) },
    );

  it('forwards password reset and verification without a session', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response('{}', { status: 202 });
      }),
    );

    for (const path of [
      ['v1', 'auth', 'password', 'forgot'],
      ['v1', 'auth', 'password', 'reset'],
      ['v1', 'auth', 'email', 'verify'],
      ['v1', 'auth', 'google', 'start'],
    ]) {
      const response = await callPath(path);
      expect(response.status, path.join('/')).toBe(202);
    }

    expect(seen).toHaveLength(4);
  });

  it('passes Google redirect back to the browser rather than following it', async () => {
    // Following it server-side would fetch accounts.google.com and hand the
    // browser HTML instead of a redirect it can act on.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' },
          }),
      ),
    );

    const response = await callPath(['v1', 'auth', 'google', 'start']);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('accounts.google.com');
  });

  it('still demands a session for everything else', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Exact matches only — a `v1/auth/` prefix rule would also open /me.
    for (const path of [
      ['v1', 'auth', 'me'],
      ['v1', 'codes'],
      ['v1', 'members'],
    ]) {
      expect((await callPath(path)).status, path.join('/')).toBe(401);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
