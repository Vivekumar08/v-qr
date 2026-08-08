import type { NextRequest, NextResponse } from 'next/server';

/**
 * Both tokens live in httpOnly cookies set by the console on its own origin.
 *
 * The browser never receives either value in a form JavaScript can read, so an
 * XSS in this console cannot lift a 30-day refresh credential. That is the
 * whole reason the tokens do not travel to the client as JSON.
 */

export const ACCESS_COOKIE = 'qi_at';
export const REFRESH_COOKIE = 'qi_rt';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

const BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  // Secure everywhere except plain-http local development, where the browser
  // would refuse to store it at all.
  secure: process.env.NODE_ENV === 'production',
};

/** Matches REFRESH_TTL on the API. A longer cookie would outlive the credential. */
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const setSessionCookies = (response: NextResponse, tokens: TokenPair): void => {
  // No maxAge on the access cookie: it is a session cookie, and its real
  // lifetime is the 15 minutes the JWT enforces server-side.
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, BASE);
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...BASE,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
};

export const clearSessionCookies = (response: NextResponse): void => {
  response.cookies.set(ACCESS_COOKIE, '', { ...BASE, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...BASE, maxAge: 0 });
};

export const readTokens = (request: NextRequest): { access?: string; refresh?: string } => {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  return {
    ...(access === undefined || access === '' ? {} : { access }),
    ...(refresh === undefined || refresh === '' ? {} : { refresh }),
  };
};

/**
 * Same-origin check for state-changing requests.
 *
 * SameSite=Lax is a browser behaviour, not a guarantee. This is server-side and
 * costs nothing. A missing Origin is allowed because non-browser callers and
 * some same-origin navigations omit it entirely.
 */
export const originAllowed = (request: NextRequest): boolean => {
  if (request.method === 'GET' || request.method === 'HEAD') return true;

  const origin = request.headers.get('origin');
  if (origin === null) return true;

  const expected = process.env.CONSOLE_URL ?? request.nextUrl.origin;
  return origin === expected;
};
