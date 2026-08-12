'use client';

import { useSearchParams } from 'next/navigation';
import { useListAuditQuery } from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { AuditEntry } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ACTION_LABEL, isWriteAction, relativeTime } from './format';

/**
 * The operator trail.
 *
 * Append-only, enforced by a database trigger rather than by convention — there
 * is no edit and no delete, here or anywhere else. Reads are recorded as well
 * as writes, so an operator quietly checking what the log says about them
 * leaves a line saying so.
 *
 * Ordered by the server on a `bigserial`, not on a timestamp: two entries in
 * the same millisecond still have a defined order, which matters when the
 * question is what happened first.
 */
export function AuditTable() {
  const params = useSearchParams();
  const tenantId = params.get('tenant');

  const { data, isLoading, error } = useListAuditQuery(
    tenantId === null ? undefined : { tenantId },
  );

  if (error !== undefined) {
    const { message } = normaliseError(error);
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">Could not load the audit log</p>
        <p className="text-muted-foreground mt-1 text-sm">{message}</p>
      </div>
    );
  }

  const entries = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground text-sm">
          {tenantId === null
            ? 'Every operator action and every cross-tenant read. Append-only.'
            : 'Filtered to one organisation. Append-only.'}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">Nothing recorded yet</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Organisation</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const write = isWriteAction(entry.action);

  return (
    <TableRow>
      <TableCell
        className="text-muted-foreground text-xs whitespace-nowrap"
        title={new Date(entry.created_at).toISOString()}
      >
        {relativeTime(entry.created_at)}
      </TableCell>
      <TableCell className="text-xs">{entry.actor_email}</TableCell>
      <TableCell>
        {/* Writes are the ones somebody has to answer for. Reads are noise until
            they are not, so they stay visible but unemphasised. */}
        <Badge variant={write ? 'default' : 'secondary'}>{ACTION_LABEL[entry.action]}</Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">{entry.tenant_slug ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground max-w-md truncate text-xs" title={entry.reason ?? ''}>
        {entry.reason ?? '—'}
      </TableCell>
    </TableRow>
  );
}
