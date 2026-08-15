'use client';

import { usePlanQuery } from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { PlanFeature } from '@/lib/api/types';
import { meterFill } from '../limits';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const FEATURE_LABEL: Record<PlanFeature, string> = {
  analytics: 'Scan analytics',
  export: 'Bulk export',
  api_keys: 'API access',
};

export function UsageCard() {
  const { data, isLoading, error } = usePlanQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (error !== undefined) {
    const { message, requestId } = normaliseError(error);
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">Could not load your plan</p>
        <p className="text-muted-foreground mt-1 text-sm">{message}</p>
        {requestId !== undefined && (
          <p className="text-muted-foreground mt-2 font-mono text-xs">Request {requestId}</p>
        )}
      </div>
    );
  }

  if (data === undefined) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plan <Badge>{data.plan}</Badge>
        </CardTitle>
        <CardDescription>
          Reaching a limit stops new codes being created. Codes you have already printed keep
          resolving, always.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Meter label="Active codes" used={data.usage.active_codes} limit={data.limits.active_codes} />
        <Meter label="Seats" used={data.usage.seats} limit={data.limits.seats} />

        <div className="space-y-2">
          {/* An older backend that predates `all_features` simply omits it — the
              two repos deploy independently. Falling back to the granted list
              degrades to showing only what the tenant has, rather than crashing
              on `undefined.map`. */}
          {(data.limits.all_features ?? data.limits.features).map((feature) => {
            const included = data.limits.features.includes(feature);
            return (
              <div key={feature} className="flex items-center justify-between text-sm">
                <span className={included ? '' : 'text-muted-foreground'}>
                  {FEATURE_LABEL[feature]}
                </span>
                {/* Shown as unavailable rather than hidden, so the upgrade path
                    is discoverable rather than a thing to find out about. */}
                <Badge variant={included ? 'default' : 'secondary'}>
                  {included ? 'Included' : 'Not on this plan'}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  // Over the limit is a real state — a downgrade leaves it — so the bar is
  // clamped and coloured rather than allowed to overflow its track.
  const { show, percent, over } = meterFill(used, limit);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className={`font-mono text-xs ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
          {used} / {limit ?? 'unlimited'}
        </span>
      </div>
      {show && (
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${over ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
