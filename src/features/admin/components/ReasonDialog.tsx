'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { normaliseError } from '@/lib/api/errors';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** The API's floor. Enforced here too, so the button is dead until it is met. */
const MIN_REASON = 8;

/**
 * Every operator action goes through this.
 *
 * The reason is not optional and not a formality — it is the only thing that
 * makes "why did this customer's codes stop working" answerable six months
 * later, when the timestamp and the email address on their own explain nothing.
 * The API rejects a short one; asking for it here, before the request, means
 * nobody discovers the requirement as a failed action.
 *
 * Confirmation is the reason field itself. A separate "are you sure?" on top of
 * a sentence someone had to type would be theatre.
 */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
  /** Extra inputs — the plan picker uses this. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const tooShort = reason.trim().length < MIN_REASON;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // A double submit here would write two audit entries for one decision.
    if (busy || tooShort) return;

    setBusy(true);
    try {
      await onConfirm(reason.trim());
      toast.success(`${title} — done`);
      setOpen(false);
      setReason('');
    } catch (error) {
      toast.error(`Could not ${confirmLabel.toLowerCase()}`, {
        description: normaliseError(error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={destructive ? 'destructive' : 'outline'} size="sm" />}
      >
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e) => void onSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {children}

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ticket #1482 — confirmed phishing destination"
                autoComplete="off"
                required
                aria-describedby="reason-hint"
              />
              <p id="reason-hint" className="text-muted-foreground text-xs">
                Written to the audit log against your name, permanently. It cannot be edited or
                deleted afterwards.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              disabled={busy || tooShort}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
