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

/**
 * An operator's read-only view of a customer account.
 *
 * Deliberately a *third* cookie rather than an overwrite of the access cookie.
 * Impersonating must not cost the operator their own session — they need it
 * back the moment they exit, and to reach the admin surface again, which an
 * impersonation token is refused on.
 *
 * There is no refresh counterpart because the API issues none: the view lasts
 * one access-token lifetime and extending it requires a fresh reason on the
 * audit record.
 */
export const IMPERSONATION_COOKIE = 'qi_imp';

/**
 * The tenant being viewed, readable by the browser — and only that.
 *
 * The banner has to know it is showing somebody else's account, and a httpOnly
 * cookie cannot tell it. This holds a slug, which is public, never the token.
 */
export const IMPERSONATION_LABEL_COOKIE = 'qi_imp_as';

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

export const setImpersonationCookies = (
  response: NextResponse,
  token: string,
  tenantSlug: string,
  expiresInSeconds: number,
): void => {
  // Expires with the token itself. A cookie outliving it would leave the banner
  // claiming an impersonation that every request has already stopped honouring.
  response.cookies.set(IMPERSONATION_COOKIE, token, { ...BASE, maxAge: expiresInSeconds });
  response.cookies.set(IMPERSONATION_LABEL_COOKIE, tenantSlug, {
    ...BASE,
    httpOnly: false,
    maxAge: expiresInSeconds,
  });
};

export const clearImpersonationCookies = (response: NextResponse): void => {
  response.cookies.set(IMPERSONATION_COOKIE, '', { ...BASE, maxAge: 0 });
  response.cookies.set(IMPERSONATION_LABEL_COOKIE, '', { ...BASE, httpOnly: false, maxAge: 0 });
};

export const readImpersonation = (request: NextRequest): string | undefined => {
  const token = request.cookies.get(IMPERSONATION_COOKIE)?.value;
  return token === undefined || token === '' ? undefined : token;
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
