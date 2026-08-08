'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

type State = 'working' | 'done' | 'failed';

export function VerifyEmailPanel() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<State>('working');

  // A link with no token is already known to be broken during render. Setting
  // state for it inside the effect would be a cascading render for a fact we
  // could read off the URL.
  const hasToken = token !== '';

  useEffect(() => {
    if (!hasToken) return;

    // Fired on mount because the person already acted by clicking the link in
    // their mail; asking them to press a second button would be theatre.
    const controller = new AbortController();

    void fetch('/api/proxy/v1/auth/email/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    })
      .then((response) => setState(response.ok ? 'done' : 'failed'))
      .catch(() => setState('failed'));

    // Strict mode mounts twice; without this the second run's result races the
    // first and the panel can flicker between states.
    return () => controller.abort();
  }, [token, hasToken]);

  if (!hasToken) return <VerificationFailed />;

  if (state === 'working') {
    return <p className="text-muted-foreground text-sm">Confirming…</p>;
  }

  if (state === 'done') {
    return (
      <div className="space-y-4">
        <p className="text-sm">Your email address is confirmed.</p>
        <Button className="w-full" nativeButton={false} render={<Link href="/codes" />}>
          Go to your codes
        </Button>
      </div>
    );
  }

  return <VerificationFailed />;
}

function VerificationFailed() {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        This link is invalid or has expired. Sign in and ask for a new one from the banner at the
        top of the console.
      </p>
      <Button
        variant="outline"
        className="w-full"
        nativeButton={false}
        render={<Link href="/login" />}
      >
        Sign in
      </Button>
    </div>
  );
}
