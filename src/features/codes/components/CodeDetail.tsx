'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import {
  useGetCodeQuery,
  useRevokeCodeMutation,
  useUpdateCodeStatusMutation,
} from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { Code, CodeStatus } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DestinationPanel } from './DestinationPanel';
import { QrPanel } from './QrPanel';
import { ScanPanel } from './ScanPanel';

const STATUS_VARIANT: Record<CodeStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  revoked: 'outline',
  blocked: 'destructive',
};

/** What each status means for someone holding the printed label. */
const STATUS_MEANING: Record<CodeStatus, string> = {
  active: 'Scans resolve to the destination below.',
  paused: 'Scans show a paused page. Reversible at any time.',
  revoked: 'Scans show a retired-code page. This cannot be undone.',
  blocked: 'Blocked by an operator. Contact support.',
};

export function CodeDetail({ codeId }: { codeId: string }) {
  const { data: code, isLoading, error } = useGetCodeQuery(codeId);

  if (isLoading) return <DetailSkeleton />;

  if (error !== undefined) {
    const { message, status, requestId } = normaliseError(error);
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{status === 404 ? 'No such code' : 'Could not load this code'}</p>
        <p className="text-muted-foreground mt-1 text-sm">{message}</p>
        {requestId !== undefined && (
          <p className="text-muted-foreground mt-2 font-mono text-xs">Request {requestId}</p>
        )}
        <Button
          variant="outline"
          className="mt-4"
          nativeButton={false}
          render={<Link href="/codes" />}
        >
          Back to codes
        </Button>
      </div>
    );
  }

  if (code === undefined) return null;

  return (
    <div className="space-y-6">
      <Header code={code} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DestinationPanel codeId={code.id} revoked={code.status === 'revoked'} />
        <QrPanel codeId={code.id} shortCode={code.short_code} />
      </div>

      <ScanPanel codeId={code.id} />
    </div>
  );
}

function Header({ code }: { code: Code }) {
  const [updateStatus, { isLoading: isUpdating }] = useUpdateCodeStatusMutation();
  const [revoke, { isLoading: isRevoking }] = useRevokeCodeMutation();

  const terminal = code.status === 'revoked' || code.status === 'blocked';

  const onToggle = async () => {
    const next = code.status === 'paused' ? 'active' : 'paused';
    try {
      await updateStatus({ id: code.id, status: next }).unwrap();
      toast.success(next === 'paused' ? 'Code paused' : 'Code resumed');
    } catch (caught) {
      toast.error('Could not change status', { description: normaliseError(caught).message });
    }
  };

  const onRevoke = async () => {
    // Terminal and irreversible, against a label already in the world. The
    // confirmation names the code so it cannot be triggered on the wrong one.
    if (!window.confirm(`Revoke ${code.short_code}? This cannot be undone.`)) return;
    try {
      await revoke(code.id).unwrap();
      toast.success(`${code.short_code} revoked`);
    } catch (caught) {
      toast.error('Could not revoke code', { description: normaliseError(caught).message });
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/codes" className="text-muted-foreground hover:text-foreground text-sm">
        ← Codes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{code.short_code}</h1>
            <Badge variant={STATUS_VARIANT[code.status]}>{code.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{STATUS_MEANING[code.status]}</p>
        </div>

        <div className="flex gap-2">
          {code.status !== 'blocked' && (
            <Button
              variant="outline"
              disabled={terminal || isUpdating}
              onClick={() => void onToggle()}
            >
              {code.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={terminal || isRevoking}
            onClick={() => void onRevoke()}
          >
            {isRevoking ? 'Revoking…' : 'Revoke'}
          </Button>
        </div>
      </div>

      <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-4">
        <Field label="GTIN" value={code.gtin} mono />
        <Field label="Serial" value={code.serial} mono />
        <Field label="Created" value={new Date(code.created_at).toLocaleString()} />
        <Field label="Code ID" value={code.id} mono />
      </dl>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`mt-0.5 truncate ${mono === true ? 'font-mono text-xs' : ''}`}>
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
