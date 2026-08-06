'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useListCodesQuery, useRevokeCodeMutation } from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { Code, CodeStatus } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateCodeDialog } from './CreateCodeDialog';
import { ExportDialog } from './ExportDialog';

/**
 * Status drives the badge colour. Revoked is deliberately not styled as an
 * error: it is a normal terminal state a customer chose, not a fault.
 */
const STATUS_VARIANT: Record<CodeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  revoked: 'outline',
  blocked: 'destructive',
};

export function CodesTable() {
  // Cursor pagination is forward-only by design, so history is kept to make
  // "previous" work without asking the API for something it cannot express.
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, error, refetch } = useListCodesQuery({
    limit: 25,
    ...(cursors[page] === undefined ? {} : { cursor: cursors[page] }),
  });

  if (isLoading) return <CodesTableSkeleton />;

  if (error !== undefined) {
    const { message, requestId } = normaliseError(error);
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">Could not load codes</p>
        <p className="text-muted-foreground mt-1 text-sm">{message}</p>
        {requestId !== undefined && (
          <p className="text-muted-foreground mt-2 font-mono text-xs">
            Request {requestId}
          </p>
        )}
        <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const codes = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Codes</h1>
          <p className="text-muted-foreground text-sm">
            Each code resolves to a destination you can change without reprinting.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDialog />
          <CreateCodeDialog />
        </div>
      </div>

      {codes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Short code</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>GS1</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
              {codes.map((code) => (
                <CodeRow key={code.id} code={code} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {codes.length} shown{data?.has_more === true ? ', more available' : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data?.has_more !== true || isFetching}
            onClick={() => {
              const next = data?.next_cursor ?? undefined;
              setCursors((existing) =>
                page + 1 < existing.length
                  ? existing
                  : [...existing.slice(0, page + 1), next],
              );
              setPage((p) => p + 1);
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function CodeRow({ code }: { code: Code }) {
  const [revoke, { isLoading }] = useRevokeCodeMutation();

  const onRevoke = async () => {
    // Terminal and irreversible — the API has no un-revoke, because a label is
    // already in the world. Worth one confirmation.
    if (!window.confirm(`Revoke ${code.short_code}? This cannot be undone.`)) return;

    try {
      await revoke(code.id).unwrap();
      toast.success(`${code.short_code} revoked`, {
        description: 'Scans now show a retired-code page.',
      });
    } catch (error) {
      const { message, requestId } = normaliseError(error);
      toast.error('Could not revoke code', {
        description: requestId === undefined ? message : `${message} (${requestId})`,
      });
    }
  };

  const terminal = code.status === 'revoked' || code.status === 'blocked';

  return (
    <TableRow>
      <TableCell className="font-mono font-medium">
        <Link href={`/codes/${code.id}`} className="hover:underline">
          {code.short_code}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-xs truncate">
        {code.destination?.url ?? '—'}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {code.gtin === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            {code.gtin}
            {code.serial !== null && <span className="text-muted-foreground"> / {code.serial}</span>}
          </>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[code.status]}>{code.status}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          disabled={terminal || isLoading}
          onClick={() => void onRevoke()}
        >
          {isLoading ? 'Revoking…' : 'Revoke'}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <p className="font-medium">No codes yet</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
        Create one to get a permanent short code you can point anywhere. The printed URL never
        changes, only where it leads.
      </p>
    </div>
  );
}

function CodesTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-40" />
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
