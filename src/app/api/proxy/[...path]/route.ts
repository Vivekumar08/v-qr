import { NextResponse, type NextRequest } from 'next/server';
import {
  clearSessionCookies,
  originAllowed,
  readTokens,
  setSessionCookies,
  type TokenPair,
} from '@/lib/auth/cookies';

/**
 * Server-side proxy to the qr-infra API.
 *
 * The browser holds its credentials in httpOnly cookies it cannot read; this
 * route turns them into an Authorization header. An XSS in the console can
 * therefore make requests as the user, but cannot walk away with a 30-day
 * refresh token to use later or elsewhere.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8787';

/** Forwarded verbatim to the API; anything else is dropped. */
const FORWARD_REQUEST_HEADERS = ['content-type', 'idempotency-key'];

/** Returned to the browser. The rest is noise or leaks upstream detail. */
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'x-request-id',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'retry-after',
];

const responseHeaders = (upstream: Response): Headers => {
  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
};

const notSignedIn = (): NextResponse =>
  NextResponse.json(
    {
      error: {
        type: 'authentication',
        code: 'not_signed_in',
        message: 'Sign in to continue.',
        request_id: 'proxy',
      },
    },
    { status: 401 },
  );

const proxy = async (
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> => {
  if (!originAllowed(request)) {
    return NextResponse.json({ error: { code: 'bad_origin' } }, { status: 403 });
  }

  const { access, refresh } = readTokens(request);
  if (access === undefined && refresh === undefined) return notSignedIn();

  // Next 16 makes route params async.
  const { path } = await context.params;
  const target = `${API_BASE_URL}/${path.join('/')}${request.nextUrl.search}`;

  const baseHeaders = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) baseHeaders.set(name, value);
  }

  // Read once: the body cannot be streamed twice, and a 401 retry needs it again.
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  const attempt = async (token: string): Promise<Response> => {
    const headers = new Headers(baseHeaders);
    headers.set('authorization', `Bearer ${token}`);

    return fetch(target, {
      method: request.method,
      headers,
      ...(body === undefined ? {} : { body }),
      // The console shows live state; a cached response would show a revoked
      // code as still active.
      cache: 'no-store',
    });
  };

  let upstream: Response;
  try {
    upstream = access === undefined ? new Response(null, { status: 401 }) : await attempt(access);
  } catch {
    return NextResponse.json(
      {
        error: {
          type: 'server_error',
          code: 'upstream_unreachable',
          message: `Could not reach the API at ${API_BASE_URL}.`,
          request_id: 'proxy',
        },
      },
      { status: 502 },
    );
  }

  /**
   * Exactly one refresh, exactly one retry.
   *
   * A loop would turn an expired refresh token into an infinite request storm
   * against the API, from every open tab at once. If the retry also fails, the
   * session is genuinely over and the client is told.
   */
  if (upstream.status === 401 && refresh !== undefined) {
    const refreshed = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: 'no-store',
    }).catch(() => null);

    if (refreshed !== null && refreshed.ok) {
      const { tokens } = (await refreshed.json()) as { tokens: TokenPair };
      const retried = await attempt(tokens.access_token);

      // NextResponse, not Response: it carries the same streamed body and is
      // the only one of the two with a cookie jar. Casting a plain Response
      // here type-checks and throws at runtime on every refresh.
      const response = new NextResponse(retried.body, {
        status: retried.status,
        headers: responseHeaders(retried),
      });

      // The rotated refresh token must be persisted. Presenting the old one on
      // the next request is a replay, which the API's reuse detection reads as
      // theft and answers by revoking the whole family.
      setSessionCookies(response, tokens);
      return response;
    }

    const dead = notSignedIn();
    clearSessionCookies(dead);
    return dead;
  }

  // Streamed straight through, so a large export is never buffered here.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders(upstream),
  });
};

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

/** Proxying is inherently dynamic; caching it would serve stale code state. */
export const dynamic = 'force-dynamic';
