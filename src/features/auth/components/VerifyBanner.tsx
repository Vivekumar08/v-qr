'use client';

import { useState } from 'react';
import { useMeQuery } from '@/lib/api/qrInfraApi';
import { Button } from '@/components/ui/button';

export function VerifyBanner() {
  const { data } = useMeQuery();
  const [sent, setSent] = useState(false);

  if (data === undefined || data.user.email_verified) return null;

  const resend = async () => {
    await fetch('/api/proxy/v1/auth/email/resend', { method: 'POST' }).catch(() => undefined);
    setSent(true);
  };

  return (
    <div className="border-border/60 bg-muted/40 flex flex-wrap items-center gap-3 border-b px-5 py-2.5 text-sm lg:px-8">
      <p className="text-muted-foreground">
        Confirm <span className="text-foreground">{data.user.email}</span> to invite teammates and
        connect a custom domain.{' '}
        {/* Said plainly: the product's promise is that printed codes keep
            working, and an unverified account must never imply otherwise. */}
        <span className="text-foreground">Your codes work either way.</span>
      </p>
      <Button size="xs" variant="outline" className="ml-auto" disabled={sent} onClick={() => void resend()}>
        {sent ? 'Sent' : 'Resend email'}
      </Button>
    </div>
  );
}
