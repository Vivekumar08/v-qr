import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/proxy/[...path]/route';
import { DELETE, POST } from '@/app/api/admin/impersonate/route';
import {
  ACCESS_COOKIE,
  IMPERSONATION_COOKIE,
  IMPERSONATION_LABEL_COOKIE,
  REFRESH_COOKIE,
} from '../cookies';

/**
 * Operator impersonation, from the console's side.
 *
 * The rule the API enforces is that an impersonation token cannot write and
 * cannot reach the admin surface. The rule *this* side has to enforce is
 * narrower and easier to get wrong: an expired impersonation must never be
 * refreshed. The only refresh token on hand belongs to the operator, so
 * spending it would quietly return a full-strength operator session while the
 * banner still claimed a read-only view of somebody else's account.
 */

const proxy = (cookie: string, segments = ['v1', 'codes']) =>
  GET(
    new NextRequest(`http://localhost:3000/api/proxy/${segments.join('/')}`, {
      headers: { cookie },
    }),
    { params: Promise.resolve({ path: segments }) },
  );

const operatorSession = `${ACCESS_COOKIE}=operator-access; ${REFRESH_COOKIE}=operator-refresh`;
const impersonating = `${operatorSession}; ${IMPERSONATION_COOKIE}=imp-token; ${IMPERSONATION_LABEL_COOKIE}=acme`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the proxy while impersonating', () => {
  it('sends the impersonation token, not the operator’s own', async () => {
    // Otherwise the screens would answer as the operator's organisation while
    // the banner named the customer's.
    const headers: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        headers.push(new Headers(init.headers).get('authorization'));
        return new Response('{}', { status: 200 });
      }),
    );

    expect((await proxy(impersonating)).status).toBe(200);
    expect(headers[0]).toBe('Bearer imp-token');
  });

  it('never spends the operator’s refresh token to extend it', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return new Response('{}', { status: 401 });
      }),
    );

    const response = await proxy(impersonating);

    expect(response.status).toBe(401);
    // One attempt and no refresh. A refresh here would hand back operator
    // authority under a read-only banner.
    expect(calls).toHaveLength(1);
    expect(calls.some((url) => url.includes('/v1/auth/refresh'))).toBe(false);
  });

  it('ends the view on expiry and says so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));

    const response = await proxy(impersonating);
    const body = (await response.json()) as { error: { code: string } };
    const cookies = response.headers.get('set-cookie') ?? '';

    expect(body.error.code).toBe('impersonation_expired');
    // Both cookies dropped — the label outliving the token would leave a banner
    // claiming a view every request has stopped honouring.
    expect(cookies).toContain(`${IMPERSONATION_COOKIE}=`);
    expect(cookies).toContain(`${IMPERSONATION_LABEL_COOKIE}=`);
    expect(cookies).toContain('Max-Age=0');
  });

  it('leaves the operator’s own session untouched', async () => {
    // They need it back the moment they exit, and to reach the admin surface,
    // which an impersonation token is refused on.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));

    const cookies = (await proxy(impersonating)).headers.get('set-cookie') ?? '';

    expect(cookies).not.toContain(`${ACCESS_COOKIE}=;`);
    expect(cookies).not.toContain(`${REFRESH_COOKIE}=;`);
  });

  it('still refreshes normally when no impersonation is active', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes('/v1/auth/refresh')) {
          return new Response(
            JSON.stringify({ tokens: { access_token: 'fresh', refresh_token: 'rotated' } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('{}', { status: calls.length === 1 ? 401 : 200 });
      }),
    );

    expect((await proxy(operatorSession)).status).toBe(200);
    expect(calls.some((url) => url.includes('/v1/auth/refresh'))).toBe(true);
  });
});

describe('starting and ending an impersonation', () => {
  const startCall = (cookie: string, body: Record<string, unknown>) =>
    POST(
      new NextRequest('http://localhost:3000/api/admin/impersonate', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify(body),
      }),
    );

  const issued = () =>
    new Response(
      JSON.stringify({
        access_token: 'imp-token',
        tenant_slug: 'acme',
        expires_in: 900,
        read_only: true,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );

  it('keeps the token server-side and returns only the label', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => issued()));

    const response = await startCall(operatorSession, { tenant_id: 't-1', reason: 'ticket 1482' });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    // The credential goes into a httpOnly cookie and nowhere else — an XSS in
    // the console must not be able to lift a token that reads a customer.
    expect(body).not.toHaveProperty('access_token');
    expect(body.tenant_slug).toBe('acme');

    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('imp-token');
    expect(cookies).toContain('HttpOnly');
  });

  it('forwards the operator’s access token to the API', async () => {
    const headers: (string | null)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        headers.push(new Headers(init.headers).get('authorization'));
        return issued();
      }),
    );

    await startCall(operatorSession, { tenant_id: 't-1', reason: 'ticket 1482' });
    expect(headers[0]).toBe('Bearer operator-access');
  });

  it('refuses without a tenant and a reason', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect((await startCall(operatorSession, { tenant_id: 't-1' })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets no cookie when the API refuses', async () => {
    // A 404 here is what a non-operator gets. Storing anything would leave the
    // console claiming a view that does not exist.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));

    const response = await startCall(operatorSession, { tenant_id: 't-1', reason: 'ticket 1482' });

    expect(response.status).toBe(404);
    expect(response.headers.get('set-cookie') ?? '').not.toContain(IMPERSONATION_COOKIE);
  });

  it('exits by dropping the cookies, touching nothing upstream', async () => {
    // The token is short-lived and stateless, so there is nothing to revoke.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await DELETE(
      new NextRequest('http://localhost:3000/api/admin/impersonate', {
        method: 'DELETE',
        headers: { cookie: impersonating, origin: 'http://localhost:3000' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie') ?? '').toContain('Max-Age=0');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
