'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAddDestinationMutation, useListDestinationsQuery } from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { Destination, Reputation } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Reputation is the operator's signal, not a status. `flagged` still resolves —
 * the API does not silently stop serving a destination — so it is shown as a
 * warning rather than an error state.
 */
const REPUTATION_VARIANT: Record<Reputation, 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  clean: 'secondary',
  flagged: 'destructive',
};

export function DestinationPanel({ codeId, revoked }: { codeId: string; revoked: boolean }) {
  const [url, setUrl] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { data, isLoading, error } = useListDestinationsQuery(codeId);
  const [addDestination, { isLoading: isSaving }] = useAddDestinationMutation();

  const history = data?.data ?? [];
  const active = history.find((destination) => destination.active);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFieldError(null);

    try {
      await addDestination({ id: codeId, url: url.trim() }).unwrap();
      toast.success('Destination updated', {
        description: 'Live within seconds. Printed labels are unaffected.',
      });
      setUrl('');
    } catch (caught) {
      const normalised = normaliseError(caught);
      if (normalised.param !== undefined) {
        setFieldError(normalised.message);
        return;
      }
      toast.error('Could not repoint code', { description: normalised.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Destination</CardTitle>
        <CardDescription>
          Where a scan lands. Changing it is the point of the product — the label never changes.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : error !== undefined ? (
          <p className="text-muted-foreground text-sm">{normaliseError(error).message}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Currently resolving to</p>
            <p className="font-mono text-sm break-all">{active?.url ?? '—'}</p>
          </div>
        )}

        {revoked ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            This code is revoked. Scans return a retired-code page and the destination can no longer
            be changed.
          </p>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-2">
            <Label htmlFor="destination-url">Point to a new URL</Label>
            <div className="flex gap-2">
              <Input
                id="destination-url"
                type="url"
                required
                placeholder="https://example.com/product"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                {...(fieldError === null ? {} : { 'aria-invalid': true })}
              />
              <Button type="submit" disabled={isSaving || url.trim() === ''}>
                {isSaving ? 'Saving…' : 'Repoint'}
              </Button>
            </div>
            {fieldError !== null && <p className="text-destructive text-sm">{fieldError}</p>}
            <p className="text-muted-foreground text-xs">
              Each change is a new version. Nothing is overwritten, so the history below is the audit
              trail.
            </p>
          </form>
        )}

        {history.length > 1 && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-medium">History</p>
              <ol className="space-y-3">
                {history.map((destination) => (
                  <DestinationRow key={destination.version} destination={destination} />
                ))}
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DestinationRow({ destination }: { destination: Destination }) {
  return (
    <li className="flex items-start justify-between gap-4 text-sm">
      <div className="min-w-0 space-y-0.5">
        <p className={`font-mono break-all ${destination.active ? '' : 'text-muted-foreground'}`}>
          {destination.url}
        </p>
        <p className="text-muted-foreground text-xs">
          v{destination.version} · {new Date(destination.created_at).toLocaleString()}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Badge variant={REPUTATION_VARIANT[destination.reputation]}>{destination.reputation}</Badge>
        {destination.active && <Badge>active</Badge>}
      </div>
    </li>
  );
}
