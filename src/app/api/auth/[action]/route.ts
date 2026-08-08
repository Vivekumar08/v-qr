import { NextResponse, type NextRequest } from 'next/server';
import {
  clearSessionCookies,
  originAllowed,
  readTokens,
  setSessionCookies,
  type TokenPair,
} from '@/lib/auth/cookies';

/**
 * The only place a token crosses between the API and a cookie.
 *
 * Every response here is stripped of its `tokens` before it reaches the
 * browser: the client is told what happened, never handed the credential.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8787';

/** Endpoints that mint a session. Anything else is a 404, not a passthrough. */
const MINTS_SESSION: Record<string, string> = {
  login: '/v1/auth/login',
  signup: '/v1/auth/signup',
  callback: '/v1/auth/session/exchange',
  switch: '/v1/auth/switch',
};

const forward = async (path: string, body: string): Promise<Response> =>
  fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    cache: 'no-store',
  });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
): Promise<Response> {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: { code: 'bad_origin' } }, { status: 403 });
  }

  const { action } = await context.params;
  const { refresh } = readTokens(request);

  if (action === 'logout') {
    if (refresh !== undefined) {
      // Best-effort: the cookies are cleared either way, so a failed upstream
      // call cannot strand someone in a session they asked to leave.
      await forward('/v1/auth/logout', JSON.stringify({ refresh_token: refresh })).catch(
        () => undefined,
      );
    }
    const response = NextResponse.json({ ok: true });
    clearSessionCookies(response);
    return response;
  }

  const path = MINTS_SESSION[action];
  if (path === undefined) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }

  // Switching needs the refresh token, which the browser cannot read. Adding it
  // here is the point of routing through the server at all.
  const incoming = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload =
    action === 'switch' ? { ...incoming, refresh_token: refresh } : incoming;

  const upstream = await forward(path, JSON.stringify(payload));
  const body = (await upstream.json().catch(() => ({}))) as { tokens?: TokenPair };

  if (!upstream.ok || body.tokens === undefined) {
    return NextResponse.json(body, { status: upstream.status });
  }

  const { tokens, ...safe } = body;
  const response = NextResponse.json(safe, { status: upstream.status });
  setSessionCookies(response, tokens);
  return response;
}

/** Proxying a credential exchange is inherently dynamic. */
export const dynamic = 'force-dynamic';
