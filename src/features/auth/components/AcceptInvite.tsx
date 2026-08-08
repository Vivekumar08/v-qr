'use client';

import { useRouter } from 'next/navigation';
import { postAuth } from '@/lib/auth/client';
import { TokenActionForm } from './TokenActionForm';

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();

  const submit = async (): Promise<string | null> => {
    const response = await fetch('/api/proxy/v1/invites/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      tenant_id?: string;
      error?: { code?: string; message?: string };
    };

    if (!response.ok || payload.tenant_id === undefined) {
      const code = payload.error?.code;

      // Its own message, because the fix is specific: a generic error would
      // leave someone holding a link they cannot use and no idea why.
      if (code === 'invite_email_mismatch') {
        return 'This invitation was sent to a different email address. Sign in as that address, or ask for a new invitation.';
      }
      if (code === 'invite_expired') {
        return 'This invitation has expired. Ask for a new one.';
      }
      return payload.error?.message ?? 'This invitation is no longer valid.';
    }

    // Switch into the team just joined, or the next page still acts as the
    // old organisation for up to one access-token lifetime.
    await postAuth('switch', { tenant_id: payload.tenant_id });
    router.replace('/codes');
    return null;
  };

  return (
    <TokenActionForm onSubmit={submit} submitLabel="Join the team" busyLabel="Joining…">
      <p className="text-muted-foreground text-sm">
        Accepting adds your account to this organisation. You keep any organisations you already
        belong to.
      </p>
    </TokenActionForm>
  );
}
