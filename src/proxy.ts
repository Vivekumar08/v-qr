import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';

/**
 * Route gate. Next 16 calls this `proxy.ts`, not `middleware.ts`.
 *
 * It keys on the refresh cookie rather than the access cookie. The access
 * cookie is gone from the browser's point of view long before the session is,
 * so gating on it would bounce people to /login every fifteen minutes.
 *
 * This is convenience, not security: the API rejects an unauthenticated request
 * regardless. It exists so someone lands on a sign-in screen instead of an
 * empty dashboard full of failed requests.
 */

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot',
  '/reset',
  '/verify',
  '/invite',
  '/auth/callback',
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  if (request.cookies.get(REFRESH_COOKIE) !== undefined) return NextResponse.next();

  const login = new URL('/login', request.url);
  // Carried so signing in returns you where you were headed, rather than
  // dumping everyone on the same landing page.
  if (pathname !== '/') login.searchParams.set('next', pathname);

  return NextResponse.redirect(login);
}

export const config = {
  // `api` is excluded: those routes answer with a 401 envelope the client can
  // read, and redirecting a fetch to an HTML login page is a confusing failure.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
