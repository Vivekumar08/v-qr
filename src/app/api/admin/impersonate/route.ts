import { NextResponse, type NextRequest } from 'next/server';
import {
  clearImpersonationCookies,
  clearSessionCookies,
  originAllowed,
  readTokens,
  setImpersonationCookies,
  setSessionCookies,
  type TokenPair,
} from '@/lib/auth/cookies';

/**
 * Starting and ending an impersonation.
 *
 * Its own route rather than another `/api/auth/[action]` case, because it is not
 * a session mint: it issues a second, weaker credential alongside the operator's
 * real one and must never replace it.
 *
 * The impersonation token never reaches the browser as a value. It goes
 * straight into a httpOnly cookie, exactly like the session tokens, so an XSS
 * in the console cannot lift a credential that reads a customer's account.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8787';

interface ImpersonationResponse {
  access_token: string;
  tenant_slug: string;
  expires_in: number;
  read_only: true;
}

const start = (path: string, reason: string, accessToken: string): Promise<Response> =>
  fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ reason }),
    cache: 'no-store',
  });

export async function POST(request: NextRequest): Promise<Response> {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: { code: 'bad_origin' } }, { status: 403 });
  }

  const { access, refresh } = readTokens(request);
  const { tenant_id: tenantId, reason } = (await request.json().catch(() => ({}))) as {
    tenant_id?: string;
    reason?: string;
  };

  if (typeof tenantId !== 'string' || typeof reason !== 'string') {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'A tenant and a reason are required.' } },
      { status: 400 },
    );
  }

  const path = `/v1/admin/tenants/${tenantId}/impersonate`;

  let rotated: TokenPair | null = null;
  let upstream =
    access === undefined
      ? new Response(null, { status: 401 })
      : await start(path, reason, access).catch(() => new Response(null, { status: 502 }));

  // One refresh, one retry — the operator's own session, not the impersonation.
  if (upstream.status === 401 && refresh !== undefined) {
    const refreshed = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: 'no-store',
    }).catch(() => null);

    if (refreshed === null || !refreshed.ok) {
      const dead = NextResponse.json(
        { error: { code: 'not_signed_in', message: 'Sign in to continue.' } },
        { status: 401 },
      );
      clearSessionCookies(dead);
      return dead;
    }

    ({ tokens: rotated } = (await refreshed.json()) as { tokens: TokenPair });
    upstream = await start(path, reason, rotated.access_token);
  }

  const body = (await upstream.json().catch(() => ({}))) as Partial<ImpersonationResponse>;

  if (!upstream.ok || typeof body.access_token !== 'string') {
    const failed = NextResponse.json(body, { status: upstream.status });
    // The rotated pair is live whether or not the impersonation succeeded.
    if (rotated !== null) setSessionCookies(failed, rotated);
    return failed;
  }

  const { access_token: token, ...safe } = body as ImpersonationResponse;
  const response = NextResponse.json(safe, { status: 200 });
  if (rotated !== null) setSessionCookies(response, rotated);
  setImpersonationCookies(response, token, safe.tenant_slug, safe.expires_in);
  return response;
}

/**
 * Exit. Purely local — there is nothing to revoke.
 *
 * The token is short-lived and stateless, so dropping the cookie is the whole
 * of it. The operator's own session was never touched and is live again on the
 * next request.
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: { code: 'bad_origin' } }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  clearImpersonationCookies(response);
  return response;
}

export const dynamic = 'force-dynamic';
