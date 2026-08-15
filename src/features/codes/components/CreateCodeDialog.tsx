'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useCreateCodeMutation, usePlanQuery } from '@/lib/api/qrInfraApi';
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

export function CreateCodeDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [gtin, setGtin] = useState('');
  const [serial, setSerial] = useState('');
  /** Field-level message from the API's `param`, so the error lands on the input. */
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const [createCode, { isLoading }] = useCreateCodeMutation();
  const { data: plan } = usePlanQuery();

  // `>=` not `>`: at 10 of 10 the next one is the eleventh. An over-limit
  // tenant (a downgrade leaves one) is covered by the same comparison.
  const atLimit =
    plan !== undefined &&
    plan.limits.active_codes !== null &&
    plan.usage.active_codes >= plan.limits.active_codes;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFieldError(null);

    try {
      const code = await createCode({
        url: url.trim(),
        ...(gtin.trim() === '' ? {} : { gtin: gtin.trim() }),
        ...(serial.trim() === '' ? {} : { serial: serial.trim() }),
      }).unwrap();

      toast.success(`Created ${code.short_code}`, {
        description: 'The printed URL is fixed from now on; the destination is not.',
      });
      setOpen(false);
      setUrl('');
      setGtin('');
      setSerial('');
    } catch (error) {
      const normalised = normaliseError(error);

      // The API names the offending field for validation failures. Showing it
      // inline beats a toast the user has to map back to an input themselves.
      if (normalised.param !== undefined) {
        setFieldError({ field: normalised.param, message: normalised.message });
        return;
      }
      toast.error('Could not create code', { description: normalised.message });
    }
  };

  const errorFor = (field: string) =>
    fieldError?.field === field ? fieldError.message : undefined;

  return (
    <div>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* shadcn's base-nova style is built on Base UI, which composes via a
          `render` element rather than Radix's `asChild`. */}
        <DialogTrigger render={<Button disabled={atLimit} />}>
          {atLimit ? 'Code limit reached' : 'New code'}
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={(e) => void onSubmit(e)}>
            <DialogHeader>
              <DialogTitle>Create a code</DialogTitle>
              <DialogDescription>
                The short code is permanent once printed. You can repoint it later without
                reprinting.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Field
                id="url"
                label="Destination URL"
                hint="Must use https — a printed code cannot be reprinted to fix a downgrade."
                value={url}
                onChange={setUrl}
                placeholder="https://example.com/product/42"
                error={errorFor('url')}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  id="gtin"
                  label="GTIN (optional)"
                  hint="GS1 AI 01. Accepts 8/12/13/14 digits."
                  value={gtin}
                  onChange={setGtin}
                  placeholder="96385074"
                  error={errorFor('gtin')}
                />
                <Field
                  id="serial"
                  label="Serial (optional)"
                  hint="GS1 AI 21. Requires a GTIN."
                  value={serial}
                  onChange={setSerial}
                  placeholder="SN12345"
                  error={errorFor('serial')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || url.trim() === ''}>
                {isLoading ? 'Creating…' : 'Create code'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {atLimit && (
        <p className="text-muted-foreground mt-1 text-xs">
          {plan.usage.active_codes} of {plan.limits.active_codes} codes used on the {plan.plan}{' '}
          plan. Revoking a code frees a slot; existing codes keep resolving.
        </p>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  error,
  required,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string | undefined;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={`${id}-hint`}
      />
      <p
        id={`${id}-hint`}
        className={error === undefined ? 'text-muted-foreground text-xs' : 'text-destructive text-xs'}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
