'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QrCode, BarChart3, KeyRound, Users, Shield, ScrollText } from 'lucide-react';
import { useMeQuery } from '@/lib/api/qrInfraApi';
import { useImpersonation } from '@/features/admin/useImpersonation';

/**
 * The active item is marked by a filled pill, not an underline.
 *
 * `Analytics` is shown but disabled: it arrives with plans and metering.
 * Hiding it would make the console look finished and leave someone hunting for
 * a feature that is coming; showing it greyed says what this is.
 */
const ITEMS = [
  { href: '/codes', label: 'Codes', icon: QrCode, ready: true },
  { href: '/settings/team', label: 'Team', icon: Users, ready: true },
  { href: '/settings/api-keys', label: 'API keys', icon: KeyRound, ready: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, ready: false },
] as const;

/**
 * Shown only to platform operators, and separated from the tenant navigation
 * above it — everything in this group reads across organisations, which is the
 * one thing the rest of the console never does. Running them together in a
 * single list would make a cross-tenant page look like an ordinary one.
 */
const OPERATOR_ITEMS = [
  { href: '/admin', label: 'Organisations', icon: Shield },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
] as const;

export function SideNav() {
  const pathname = usePathname();
  // Purely for rendering. The API answers 404 to anyone not on the allow-list,
  // so a forged `true` here buys two menu items and two empty pages.
  const { data: me } = useMeQuery();

  /**
   * Hidden while impersonating, because an impersonation token is refused on
   * the admin surface outright — so these links would 404 rather than take you
   * anywhere. Offering a way back to the operator console from inside a
   * customer's account also invites treating the two as one session; the
   * banner's Exit is the one route out, and it clears the view first.
   */
  const impersonating = useImpersonation() !== null;

  /**
   * Every item above the Platform group is tenant-scoped and answers
   * `no_active_tenant` without one.
   *
   * A platform operator has no organisation by design, so all three were live
   * links to an error page. Shown disabled rather than hidden: an operator
   * looking for Codes should learn why it is unavailable, not wonder whether
   * the console is broken. Also catches an ordinary user who has left their
   * last team.
   *
   * `me === undefined` is still loading — not the same as having no tenant, and
   * flashing the nav disabled on every page load would be worse than waiting.
   */
  const withoutTenant = me !== undefined && me.active_tenant_id === null;

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-2">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;

        if (!item.ready || withoutTenant) {
          return (
            <span
              key={item.href}
              className="text-muted-foreground/45 flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
              title={
                item.ready
                  ? 'Needs an organisation. Platform operators do not have one.'
                  : 'Coming with accounts and billing'
              }
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
              {!item.ready && (
                <span className="ml-auto text-[10px] tracking-wide uppercase">Soon</span>
              )}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}

      {me?.is_super_admin === true && !impersonating && (
        <>
          <p className="text-muted-foreground/60 mt-4 px-3 pb-1 text-[10px] font-medium tracking-wider uppercase">
            Platform
          </p>
          {OPERATOR_ITEMS.map((item) => {
            // Exact match on /admin, or the tenant detail pages would light up
            // both this and the audit entry at once.
            const active =
              item.href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/tenants') : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );
}
