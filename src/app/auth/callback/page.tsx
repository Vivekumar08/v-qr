import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/cookies';

/**
 * Completes the Google handoff.
 *
 * The exchange runs here, on the server, so the one-time code is spent before
 * the page is delivered — and so the tokens it returns exist only as httpOnly
 * cookies, never as anything the browser can read.
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://127.0.0.1:8787';

export default async function GoogleCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code === undefined) redirect('/login?error=oauth');

  const response = await fetch(`${API_BASE_URL}/v1/auth/session/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
    cache: 'no-store',
  }).catch(() => null);

  if (response === null || !response.ok) redirect('/login?error=oauth');

  const { tokens, active_tenant_id: activeTenantId } = (await response.json()) as {
    tokens: { access_token: string; refresh_token: string };
    active_tenant_id: string | null;
  };

  const jar = await cookies();
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };

  jar.set(ACCESS_COOKIE, tokens.access_token, base);
  jar.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: 30 * 24 * 60 * 60 });

  // A Google signup has a user and no organisation, and cannot have one yet:
  // the slug becomes the printed subdomain and has to be chosen, not guessed
  // from a profile name.
  redirect(activeTenantId === null ? '/onboarding' : '/codes');
}

export const dynamic = 'force-dynamic';
