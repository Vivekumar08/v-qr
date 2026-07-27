import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side proxy to the qr-infra API.
 *
 * The browser never sees the API key. Anything in `NEXT_PUBLIC_*` is compiled
 * into the client bundle, so a key with `codes:write` placed there is a key any
 * visitor can lift from devtools and use to create or revoke codes — and a
 * revoked code is a printed label that stops working.
 *
 * This is a deliberate stand-in for real user sessions. Every request currently
 * uses one tenant's key; once the console has authentication, the key is chosen
 * per session here rather than anywhere in the client.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8787';
const API_KEY = process.env.QR_INFRA_API_KEY;

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

const proxy = async (
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> => {
  if (API_KEY === undefined || API_KEY === '') {
    // Loud and specific: a blank page because of a missing env var wastes far
    // more time than an explicit error.
    return NextResponse.json(
      {
        error: {
          type: 'server_error',
          code: 'api_key_not_configured',
          message: 'QR_INFRA_API_KEY is not set. Copy .env.example to .env.local and fill it in.',
          request_id: 'proxy',
        },
      },
      { status: 500 },
    );
  }

  // Next 16 makes route params async.
  const { path } = await context.params;
  const search = request.nextUrl.search;
  const target = `${API_BASE_URL}/${path.join('/')}${search}`;

  const headers = new Headers({ authorization: `Bearer ${API_KEY}` });
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      // GET and HEAD must not carry a body, and duplex is required when one is
      // streamed through.
      ...(request.method === 'GET' || request.method === 'HEAD'
        ? {}
        : { body: request.body, duplex: 'half' as const }),
      // The console shows live state; a cached proxy response would show a
      // revoked code as still active.
      cache: 'no-store',
    });
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

  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }

  // Streamed straight through, so a large export is not buffered here.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

/** Proxying is inherently dynamic; caching it would serve stale code state. */
export const dynamic = 'force-dynamic';
