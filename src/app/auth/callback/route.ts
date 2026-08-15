import { NextResponse, type NextRequest } from 'next/server';
import { setSessionCookies, type TokenPair } from '@/lib/auth/cookies';
import { isOperator, landingFor } from '@/lib/auth/landing';

/**
 * Completes the Google handoff.
 *
 * A Route Handler, not a page, and that distinction is the whole point: Next
 * refuses to let a Server Component set a cookie. As a page this threw *after*
 * the exchange had already consumed the one-time code, so every attempt burned
 * a fresh code and ended on an error — sign-in that could never succeed and
 * never looked like the same failure twice.
 *
 * The exchange still happens server-side, so the code is spent before anything
 * reaches the browser and the tokens exist only as httpOnly cookies.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8787';

const backToLogin = (request: NextRequest, reason: string): NextResponse =>
  NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  if (code === null || code === '') return backToLogin(request, 'oauth');

  const response = await fetch(`${API_BASE_URL}/v1/auth/session/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
    cache: 'no-store',
  }).catch(() => null);

  if (response === null) return backToLogin(request, 'unreachable');
  if (!response.ok) return backToLogin(request, 'oauth_expired');

  const { tokens, active_tenant_id: activeTenantId } = (await response.json()) as {
    tokens: TokenPair;
    active_tenant_id: string | null;
  };

  // A Google signup has a user and no organisation, and cannot have one yet:
  // the slug becomes the printed subdomain and has to be chosen deliberately,
  // not guessed from a profile name. An operator has none either, and must not
  // be sent to a form asking them to create one.
  const isSuperAdmin =
    activeTenantId === null
      ? await isOperator(`${API_BASE_URL}/v1/auth/me`, tokens.access_token)
      : false;

  const redirect = NextResponse.redirect(
    new URL(landingFor({ activeTenantId, isSuperAdmin }), request.url),
  );
  setSessionCookies(redirect, tokens);
  return redirect;
}

export const dynamic = 'force-dynamic';
