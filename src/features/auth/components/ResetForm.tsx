'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TokenActionForm } from './TokenActionForm';

export function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');

  const submit = async (): Promise<string | null> => {
    const response = await fetch('/api/proxy/v1/auth/password/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    if (response.ok) {
      // Says outright that everything was signed out. Otherwise the person is
      // left wondering why their phone logged them out an hour later.
      router.replace('/login?reset=1');
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };

    return payload.error?.code === 'reset_token_invalid'
      ? 'This link is invalid or has expired. Request a new one.'
      : (payload.error?.message ?? 'Could not reset the password.');
  };

  if (token === '') {
    return <p className="text-muted-foreground text-sm">This link is missing its token.</p>;
  }

  return (
    <TokenActionForm
      onSubmit={submit}
      submitLabel="Set new password"
      busyLabel="Saving…"
      disabled={password.length < 12}
    >
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          At least 12 characters. Setting it signs out every other session.
        </p>
      </div>
    </TokenActionForm>
  );
}
