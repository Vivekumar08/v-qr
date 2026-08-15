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
  'tenant.plan_changed': 'changed plan',
  'tenant.suspended': 'suspended organisation',
  'tenant.unsuspended': 'lifted suspension',
  'users.list': 'listed users',
  'codes.read': 'read codes',
  'code.blocked': 'blocked a code',
  'code.unblocked': 'unblocked a code',
  'scans.read': 'read scans',
  'impersonation.start': 'viewed as customer',
  'audit.read': 'read the audit log',
};

/**
 * The reads, named explicitly.
 *
 * This was written the other way round — "anything that is not one of these
 * three reads is a write" — and every action the console had not heard of was
 * badged as a write. `codes.read` showed up in the log looking like an
 * intervention. Listing the reads is no safer in principle, but it fails in the
 * better direction: an unrecognised action is emphasised rather than hidden,
 * and an operator asks about it.
 */
const READ_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  'tenants.list',
  'tenant.read',
  'users.list',
  'codes.read',
  'scans.read',
  'audit.read',
]);

/**
 * Reads carry no consequence and stay unemphasised. Everything else does.
 *
 * Impersonation counts even though it changes nothing: it is the entry somebody
 * has to answer for, and burying it among the routine reads is exactly how it
 * would go unnoticed.
 */
export const isWriteAction = (action: AuditAction): boolean => !READ_ACTIONS.has(action);

/**
 * Falls back to the raw value rather than rendering nothing.
 *
 * The API's error codes are additive, so a new action can appear here before
 * this console knows the name — and an audit row with a blank action is worse
 * than an ugly one.
 */
export const labelFor = (action: AuditAction): string => ACTION_LABEL[action] ?? action;
