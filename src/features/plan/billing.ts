import type { BillingCycle, BillingState } from '@/lib/api/types';

/**
 * Pure logic pulled out of `BillingPanel` so it can be unit tested directly,
 * following the same split as `limits.ts`: the component stays untested per
 * repo convention, the decisions it renders do not have to be.
 */

/** One cycle with a real, non-null price — what `NoSubscription` has to offer. */
export interface AvailableCycle {
  cycle: BillingCycle;
  paise: number;
}

/**
 * Which cycles have a real price to subscribe to.
 *
 * Both prices are nullable (no `billing_plans` seed row yet); a null price
 * must never render as "₹null" or a button that would 400, so a cycle is
 * only "available" once its price is a real number. Order is fixed
 * (monthly, then annual) regardless of which entries survive the filter.
 */
export function selectAvailableCycles(prices: BillingState['prices']): AvailableCycle[] {
  return (['monthly', 'annual'] as const)
    .map((cycle) => ({ cycle, paise: prices[`${cycle}_paise`] }))
    .filter((entry): entry is AvailableCycle => entry.paise !== null);
}

/**
 * Whether a Subscribe button for `cycle` may be clicked right now.
 *
 * `startingCycle` is the cycle a subscribe attempt is already in flight for,
 * or `null` if none is. This does not special-case `cycle === startingCycle`
 * on purpose: a double-click charges the customer twice — mints a second
 * Razorpay payment mandate on top of the first — and that is true whether
 * the second click hits the same cycle's button (a literal double-click) or
 * the other cycle's button (start monthly, then click annual before the
 * first request lands). Both are the same bug, so both are blocked by the
 * same rule: while anything is starting, nothing is clickable.
 */
export function canStartSubscribe(startingCycle: BillingCycle | null): boolean {
  return startingCycle === null;
}
