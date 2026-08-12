'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useListAdminTenantsQuery } from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { AdminTenant } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlanBadge, relativeTime } from './format';

/**
 * Every organisation on the platform.
 *
 * Counts, never contents. An operator is looking for shape — who is suspended,
 * who has stopped scanning, who suddenly has ten thousand codes — and none of
 * those questions need a customer's destination URLs to answer.
 *
 * The search box filters server-side rather than in the browser, because the
 * list is capped at 200 and the answer to "why can't I find them" must not be
 * "they were past the cap".
 */
export function TenantList() {
  const [search, setSearch] = useState('');

  // Each call writes a `tenants.list` audit entry, so this deliberately does not
  // refetch as you type. It queries on submit.
  const [query, setQuery] = useState('');
  const { data, isLoading, isFetching, error } = useListAdminTenantsQuery(
    query === '' ? undefined : { search: query },
  );

  if (error !== undefined) {
    const { message, status } = normaliseError(error);
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{status === 404 ? 'Not found' : 'Could not load tenants'}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {status === 404
            ? 'This account is not a platform operator.'
            : message}
        </p>
      </div>
    );
  }

  const tenants = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Organisations</h1>
        <p className="text-muted-foreground text-sm">
          Every tenant on the platform. Reading this page is itself recorded in the audit log.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or slug, then press Enter"
          className="max-w-sm"
          aria-label="Search organisations"
        />
      </form>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : tenants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">No organisations match</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {query === '' ? 'Nothing has signed up yet.' : `Nothing matching “${query}”.`}
          </p>
        </div>
      ) : (
        <div className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Codes</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead>Last scan</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <Row key={tenant.id} tenant={tenant} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Row({ tenant }: { tenant: AdminTenant }) {
  return (
    <TableRow className={tenant.suspended ? 'opacity-60' : undefined}>
      <TableCell>
        <Link href={`/admin/tenants/${tenant.id}`} className="hover:underline">
          <span className="font-medium">{tenant.name}</span>
          <span className="text-muted-foreground ml-2 font-mono text-xs">{tenant.slug}</span>
        </Link>
        {tenant.suspended && (
          <Badge variant="destructive" className="ml-2">
            suspended
          </Badge>
        )}
        {tenant.custom_domain !== null && (
          <span className="text-muted-foreground ml-2 font-mono text-xs">
            {tenant.custom_domain}
          </span>
        )}
      </TableCell>
      <TableCell>
        <PlanBadge plan={tenant.plan} />
      </TableCell>
      <TableCell className="text-right font-mono text-xs">
        {/* Active over total: the gap is the interesting number — a tenant with
            900 codes and 4 active has either churned or been blocked. */}
        {tenant.active_code_count}
        <span className="text-muted-foreground">/{tenant.code_count}</span>
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{tenant.member_count}</TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {relativeTime(tenant.last_scan_at)}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(tenant.created_at).toLocaleDateString()}
      </TableCell>
    </TableRow>
  );
}
