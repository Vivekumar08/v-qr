import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { AcceptInvite } from '@/features/auth/components/AcceptInvite';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';

export const metadata = { title: 'Join a team · qr-infra' };

/** Next 16 makes route params async. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const jar = await cookies();

  // Signed out: carry the token through signup so the account is created with
  // the invited address already in hand, and the link still works afterwards.
  if (jar.get(REFRESH_COOKIE) === undefined) {
    redirect(`/signup?invite=${encodeURIComponent(token)}`);
  }

  return (
    <AuthShell title="Join a team">
      <AcceptInvite token={token} />
    </AuthShell>
  );
}

export const dynamic = 'force-dynamic';
