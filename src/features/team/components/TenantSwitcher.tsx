'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { qrInfraApi, useMeQuery } from '@/lib/api/qrInfraApi';
import { postAuth } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TenantSwitcher() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { data } = useMeQuery();
  const [switching, setSwitching] = useState(false);

  const memberships = data?.memberships ?? [];
  const active = memberships.find((m) => m.tenant.id === data?.active_tenant_id);

  // One organisation is not a choice. Rendering a picker for it is noise.
  if (memberships.length < 2) {
    return active === undefined ? null : (
      <span className="text-muted-foreground truncate text-sm">{active.tenant.name}</span>
    );
  }

  const switchTo = async (tenantId: string) => {
    if (tenantId === data?.active_tenant_id) return;
    setSwitching(true);

    const result = await postAuth('switch', { tenant_id: tenantId });
    setSwitching(false);
    if (!result.ok) return;

    // The cache is keyed by endpoint, not by tenant. Without a reset the
    // previous organisation's codes stay on screen under the new one's name —
    // alarming, and shaped exactly like a data leak in a bug report.
    dispatch(qrInfraApi.util.resetApiState());
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" disabled={switching} />}
      >
        <span className="max-w-40 truncate">{active?.tenant.name ?? 'Select organisation'}</span>
        <ChevronsUpDown className="size-3.5 opacity-60" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        {memberships.map((membership) => (
          <DropdownMenuItem
            key={membership.tenant.id}
            onClick={() => void switchTo(membership.tenant.id)}
          >
            <span className="flex-1 truncate">{membership.tenant.name}</span>
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
              {membership.role}
            </span>
            {membership.tenant.id === data?.active_tenant_id && (
              <Check className="size-3.5" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
