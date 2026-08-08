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

type Action = 'login' | 'signup' | 'callback' | 'switch';

/** Endpoints that mint a session. Anything else is a 404, not a passthrough. */
const MINTS_SESSION: Record<Action, string> = {
  login: '/v1/auth/login',
  signup: '/v1/auth/signup',
  callback: '/v1/auth/session/exchange',
  switch: '/v1/auth/switch',
};

/**
 * Actions the API treats as authenticated.
 *
 * Switching organisation is something only a signed-in person can do, so it
 * needs the access token forwarded. Login, signup and the OAuth handoff are how
 * a session begins and deliberately carry none.
 */
const NEEDS_ACCESS_TOKEN: ReadonlySet<Action> = new Set<Action>(['switch']);

const isAction = (value: string): value is Action => value in MINTS_SESSION;

const forward = async (path: string, body: unknown, accessToken?: string): Promise<Response> =>
  fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken === undefined ? {} : { authorization: `Bearer ${accessToken}` }),
    },
    body: JSON.stringify(body),
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
  const { access, refresh } = readTokens(request);

  if (action === 'logout') {
    if (refresh !== undefined) {
      // Best-effort: the cookies are cleared either way, so a failed upstream
      // call cannot strand someone in a session they asked to leave.
      await forward('/v1/auth/logout', { refresh_token: refresh }).catch(() => undefined);
    }
    const response = NextResponse.json({ ok: true });
    clearSessionCookies(response);
    return response;
  }

  if (!isAction(action)) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }

  const incoming = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Switching needs the refresh token, which the browser cannot read. Supplying
  // it here is the point of routing through the server at all.
  const bodyWith = (refreshToken: string | undefined) =>
    action === 'switch' ? { ...incoming, refresh_token: refreshToken } : incoming;

  const token = NEEDS_ACCESS_TOKEN.has(action) ? access : undefined;
  let upstream = await forward(MINTS_SESSION[action], bodyWith(refresh), token);

  /**
   * One refresh, one retry — and the retried body must carry the *new* refresh
   * token.
   *
   * Switching redeems the refresh token it is given, so replaying the original
   * after a rotation presents an already-used token. The API reads that as
   * theft and revokes the entire family, signing the user out of everything for
   * what is really just an expired access token.
   */
  if (upstream.status === 401 && NEEDS_ACCESS_TOKEN.has(action) && refresh !== undefined) {
    const refreshed = await forward('/v1/auth/refresh', { refresh_token: refresh }).catch(
      () => null,
    );

    if (refreshed === null || !refreshed.ok) {
      const dead = NextResponse.json(
        { error: { code: 'not_signed_in', message: 'Sign in to continue.' } },
        { status: 401 },
      );
      clearSessionCookies(dead);
      return dead;
    }

    const { tokens: rotated } = (await refreshed.json()) as { tokens: TokenPair };
    upstream = await forward(
      MINTS_SESSION[action],
      bodyWith(rotated.refresh_token),
      rotated.access_token,
    );

    // If the retry failed, the rotated pair is still the live one — storing it
    // keeps the session usable instead of stranding the browser on a token the
    // API has already retired.
    if (!upstream.ok) {
      const failed = NextResponse.json(await upstream.json().catch(() => ({})), {
        status: upstream.status,
      });
      setSessionCookies(failed, rotated);
      return failed;
    }
  }

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
