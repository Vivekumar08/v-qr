'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { postAuth } from '@/lib/auth/client';
import { isOperator, landingFor } from '@/lib/auth/landing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Why an OAuth attempt bounced back here. Anything else stays silent. */
const OAUTH_ERRORS: Record<string, string> = {
  oauth: 'Google sign-in did not complete. Try again.',
  oauth_cancelled: 'Google sign-in was cancelled.',
  oauth_expired: 'That sign-in link expired. Try again.',
  unreachable: 'Could not reach the server. Try again in a moment.',
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const oauthError = OAUTH_ERRORS[params.get('error') ?? ''];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await postAuth<{ active_tenant_id: string | null }>('login', {
      email: email.trim(),
      password,
    });

    if (!result.ok) {
      setBusy(false);
      // Deliberately not distinguishing "no such account" from "wrong
      // password". The API refuses to, and echoing a difference here would
      // hand back the enumeration oracle it withholds.
      setError(
        result.error?.code === 'invalid_credentials'
          ? 'Email or password is incorrect.'
          : (result.error?.message ?? 'Something went wrong.'),
      );
      return;
    }

    const activeTenantId = result.data?.active_tenant_id ?? null;

    // Only asked when there is no tenant to land in, which is also the only
    // case where the answer changes anything. The proxy attaches the session.
    const isSuperAdmin =
      activeTenantId === null ? await isOperator('/api/proxy/v1/auth/me') : false;

    router.replace(landingFor({ activeTenantId, isSuperAdmin, next: params.get('next') }));
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <a href="/forgot" className="text-muted-foreground hover:text-foreground text-xs">
            Forgot?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {(error ?? oauthError) !== undefined && (error ?? oauthError) !== null && (
        <p className="text-destructive text-sm">{error ?? oauthError}</p>
      )}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
