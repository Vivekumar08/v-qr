'use client';

import { useState } from 'react';
import { useGetScanSummaryQuery } from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { ScanSummary } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'All', days: null },
] as const;

/**
 * Aggregates only.
 *
 * The API stores a salted hash of the client IP and never the address itself,
 * so there is no per-scan view to build and no way to add one later — which is
 * the intent. Counts by country and device answer the operational questions
 * without holding anything that identifies a person.
 */
export function ScanPanel({ codeId }: { codeId: string }) {
  // The window's end is pinned when the range is chosen rather than read from
  // the clock on every render. Reading it during render would mint a new
  // `since` each time, and a new `since` is a new cache key — the query would
  // refetch in a loop and the numbers would never settle.
  const [range, setRange] = useState(() => ({ index: 1, anchor: Date.now() }));
  const [includeBots, setIncludeBots] = useState(false);

  const selected = RANGES[range.index]!;
  const since =
    selected.days === null
      ? undefined
      : new Date(range.anchor - selected.days * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading, isFetching, error } = useGetScanSummaryQuery({
    id: codeId,
    ...(since === undefined ? {} : { since }),
    ...(includeBots ? { includeBots: true } : {}),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scans</CardTitle>
        <CardDescription>
          Counts only — no IP is stored, so there is nothing per-visitor to show.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((option, index) => (
            <Button
              key={option.label}
              size="sm"
              variant={index === range.index ? 'secondary' : 'ghost'}
              onClick={() => setRange({ index, anchor: Date.now() })}
            >
              {option.label}
            </Button>
          ))}
          <label className="text-muted-foreground ml-auto flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={includeBots}
              onChange={(event) => setIncludeBots(event.target.checked)}
            />
            Include bots
          </label>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : error !== undefined ? (
          <p className="text-muted-foreground text-sm">{normaliseError(error).message}</p>
        ) : (
          <Summary summary={data} dimmed={isFetching} />
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ summary, dimmed }: { summary: ScanSummary | undefined; dimmed: boolean }) {
  if (summary === undefined) return null;

  if (summary.total === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        No scans in this range.
      </p>
    );
  }

  return (
    <div className={`space-y-6 transition-opacity ${dimmed ? 'opacity-60' : ''}`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total" value={summary.total.toLocaleString()} />
        <Stat label="First scan" value={formatMoment(summary.first_at)} />
        <Stat label="Last scan" value={formatMoment(summary.last_at)} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Breakdown title="Country" rows={summary.by_country} total={summary.total} />
        <Breakdown title="Device" rows={summary.by_device} total={summary.total} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { key: string; count: number }[];
  total: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">Not recorded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-2">
        {rows.slice(0, 6).map((row) => (
          <li key={row.key} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-mono">{row.key === '' ? 'unknown' : row.key}</span>
              <span className="text-muted-foreground tabular-nums">
                {row.count.toLocaleString()}
              </span>
            </div>
            {/* Share of the total, not of the largest row — a bar that always
                fills to 100% overstates the leader. */}
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${Math.max((row.count / total) * 100, 2)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const formatMoment = (value: string | null): string =>
  value === null ? '—' : new Date(value).toLocaleString();
