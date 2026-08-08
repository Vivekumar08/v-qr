'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The shape shared by verify, reset and accept-invite: take a token from the
 * URL, post it once, and say what happened.
 *
 * Kept in one place because the failure copy is the important part and three
 * near-identical screens drift on exactly that.
 */
export function TokenActionForm({
  onSubmit,
  submitLabel,
  busyLabel,
  children,
  disabled,
}: {
  onSubmit: () => Promise<string | null>;
  submitLabel: string;
  busyLabel: string;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const failure = await onSubmit();
    setBusy(false);
    if (failure !== null) setError(failure);
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      {children}
      {error !== null && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || disabled === true}>
        {busy ? busyLabel : submitLabel}
      </Button>
    </form>
  );
}
