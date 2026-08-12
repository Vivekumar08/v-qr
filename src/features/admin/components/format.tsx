import type { AuditAction, TenantPlan } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';

/** Shared presentation for the operator screens. */

const PLAN_VARIANT: Record<TenantPlan, 'secondary' | 'default' | 'outline'> = {
  free: 'secondary',
  paid: 'default',
  enterprise: 'outline',
};

export function PlanBadge({ plan }: { plan: TenantPlan }) {
  return <Badge variant={PLAN_VARIANT[plan]}>{plan}</Badge>;
}

/**
 * "3 days ago" rather than a timestamp.
 *
 * An operator scanning a list is asking "is this account alive", and a date
 * makes them do the subtraction. The exact value stays in the `title`, because
 * the moment it matters it matters precisely.
 */
export function relativeTime(iso: string | null): string {
  if (iso === null) return 'never';

  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86_400],
    ['month', 2_592_000],
    ['year', 31_536_000],
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0]!;
  for (const unit of units) {
    if (seconds >= unit[1]) chosen = unit;
  }
  return formatter.format(-Math.round(seconds / chosen[1]), chosen[0]);
}

/**
 * Plain-language audit actions.
 *
 * The stored values are machine names and stay that way — they are a permanent
 * record, not a label. This is only how they read on screen.
 */
export const ACTION_LABEL: Record<AuditAction, string> = {
  'tenants.list': 'listed organisations',
  'tenant.read': 'opened organisation',
  'audit.read': 'read the audit log',
  'code.blocked': 'blocked a code',
  'code.unblocked': 'unblocked a code',
  'tenant.suspended': 'suspended organisation',
  'tenant.unsuspended': 'lifted suspension',
  'tenant.plan_changed': 'changed plan',
};

/** Reads carry no consequence; the four that change something are marked. */
export const isWriteAction = (action: AuditAction): boolean =>
  action !== 'tenants.list' && action !== 'tenant.read' && action !== 'audit.read';
