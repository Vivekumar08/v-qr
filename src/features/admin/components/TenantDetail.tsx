'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useBlockCodeMutation,
  useGetAdminTenantQuery,
  useListAdminTenantCodesQuery,
  useSetTenantPlanMutation,
  useSetTenantSuspensionMutation,
  useUnblockCodeMutation,
} from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { AdminCode, AdminTenant, TenantPlan } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReasonDialog } from './ReasonDialog';
import { PlanBadge, relativeTime } from './format';

const PLANS: TenantPlan[] = ['free', 'paid', 'enterprise'];

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const { data: tenant, isLoading, error } = useGetAdminTenantQuery(tenantId);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (error !== undefined) {
    const { message, status } = normaliseError(error);
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{status === 404 ? 'No such organisation' : 'Could not load'}</p>
        <p className="text-muted-foreground mt-1 text-sm">{message}</p>
        <Button variant="outline" className="mt-4" nativeButton={false} render={<Link href="/admin" />}>
          Back to organisations
        </Button>
      </div>
    );
  }

  if (tenant === undefined) return null;

  return (
    <div className="space-y-6">
      <Header tenant={tenant} />
      <Actions tenant={tenant} />
      <CodesPanel tenantId={tenantId} />
    </div>
  );
}

function Header({ tenant }: { tenant: AdminTenant }) {
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm">
        ← Organisations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{tenant.name}</h1>
            <PlanBadge plan={tenant.plan} />
            {tenant.suspended && <Badge variant="destructive">suspended</Badge>}
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            {tenant.custom_domain ?? tenant.slug}
          </p>
          {tenant.suspended && tenant.suspended_at !== null && (
            <p className="text-destructive text-sm">
              Suspended {relativeTime(tenant.suspended_at)}. The console is locked; printed codes
              still resolve.
            </p>
          )}
        </div>
      </div>

      <dl className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-4">
        <Stat label="Codes" value={`${tenant.active_code_count} of ${tenant.code_count} active`} />
        <Stat label="Members" value={String(tenant.member_count)} />
        <Stat label="Last scan" value={relativeTime(tenant.last_scan_at)} />
        <Stat label="Created" value={new Date(tenant.created_at).toLocaleDateString()} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 truncate">{value}</dd>
    </div>
  );
}

/**
 * The three things an operator can change.
 *
 * Suspension is stated in terms of what it does to the customer, not what it
 * does to the row: it locks the console and leaves scans resolving. That
 * distinction is the product's central promise, and an operator reaching for
 * this button is exactly the person who needs reminding of it.
 */
function Actions({ tenant }: { tenant: AdminTenant }) {
  const [setSuspension] = useSetTenantSuspensionMutation();
  const [setPlan] = useSetTenantPlanMutation();
  const [plan, setPlanChoice] = useState<TenantPlan>(tenant.plan);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {tenant.suspended ? (
          <ReasonDialog
            trigger="Lift suspension"
            title="Lift suspension"
            description="The console unlocks immediately and the organisation can make changes again."
            confirmLabel="Lift suspension"
            onConfirm={(reason) =>
              setSuspension({ tenantId: tenant.id, suspended: false, reason }).unwrap()
            }
          />
        ) : (
          <ReasonDialog
            trigger="Suspend"
            title="Suspend this organisation"
            description="Locks the console: no new codes, no repointing, no member changes. Printed codes keep resolving — suspending an account must never break somebody's packaging."
            confirmLabel="Suspend"
            destructive
            onConfirm={(reason) =>
              setSuspension({ tenantId: tenant.id, suspended: true, reason }).unwrap()
            }
          />
        )}

        <ReasonDialog
          trigger="Change plan"
          title="Change plan"
          description="Takes effect at once. Billing is not adjusted by this — it only moves the entitlement."
          confirmLabel="Change plan"
          onConfirm={(reason) => setPlan({ tenantId: tenant.id, plan, reason }).unwrap()}
        >
          <div className="space-y-1.5">
            <Label htmlFor="plan">Plan</Label>
            <Select value={plan} onValueChange={(value) => setPlanChoice(value as TenantPlan)}>
              <SelectTrigger id="plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                    {option === tenant.plan ? ' (current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </ReasonDialog>

        <ReasonDialog
          trigger="View as customer"
          title="View as customer"
          description="Opens their console as it looks to them, read-only — the API refuses every write from this session. It lasts fifteen minutes and cannot be extended without a new reason."
          confirmLabel="Start viewing"
          onConfirm={async (reason) => {
            const response = await fetch('/api/admin/impersonate', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ tenant_id: tenant.id, reason }),
            });
            if (!response.ok) throw await response.json();
            // Hard navigation: the impersonation cookie has to be in play before
            // anything renders, and every cached query belongs to the operator.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- discarding the store is the point
            window.location.assign('/codes');
          }}
        />

        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/admin/audit?tenant=${tenant.id}`} />}
        >
          Audit history
        </Button>
      </CardContent>
    </Card>
  );
}

function CodesPanel({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useListAdminTenantCodesQuery({ tenantId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (data?.data ?? []).length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            This organisation has not created any codes.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Short code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>GTIN</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).map((code) => (
                  <CodeRow key={code.id} code={code} tenantId={tenantId} />
                ))}
              </TableBody>
            </Table>
            {data?.has_more === true && (
              <p className="text-muted-foreground mt-3 text-xs">
                Showing the 25 most recent. Older codes are not listed here.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CodeRow({ code, tenantId }: { code: AdminCode; tenantId: string }) {
  const [block] = useBlockCodeMutation();
  const [unblock] = useUnblockCodeMutation();

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{code.short_code}</TableCell>
      <TableCell>
        <Badge variant={code.status === 'blocked' ? 'destructive' : 'secondary'}>
          {code.status}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">{code.gtin ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(code.created_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        {code.status === 'blocked' ? (
          <ReasonDialog
            trigger="Unblock"
            title={`Unblock ${code.short_code}`}
            description="Scans resolve to the destination again."
            confirmLabel="Unblock"
            onConfirm={(reason) => unblock({ codeId: code.id, tenantId, reason }).unwrap()}
          />
        ) : code.status === 'revoked' ? (
          // Revocation is the customer's own terminal decision. Blocking
          // something already dead would write a misleading audit entry.
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <ReasonDialog
            trigger="Block"
            title={`Block ${code.short_code}`}
            description="Scans stop resolving and show a blocked page. The customer cannot undo this themselves. Reversible by an operator."
            confirmLabel="Block"
            destructive
            onConfirm={(reason) => block({ codeId: code.id, tenantId, reason }).unwrap()}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
