'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    await fetch('/api/proxy/v1/auth/password/forgot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => undefined);

    setBusy(false);
    // The same screen either way. The API answers 202 whether or not the
    // address exists; showing a different result for a known one would hand
    // back the enumeration signal it withholds.
    setSent(true);
  };

  if (sent) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        If an account exists for that address, we have sent a reset link. It expires in one hour and
        can be used once.
      </p>
    );
  }

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
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
