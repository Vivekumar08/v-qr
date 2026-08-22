import { describe, expect, it } from 'vitest';
import { canStartSubscribe, selectAvailableCycles } from '../billing';

/**
 * `selectAvailableCycles` decides what `NoSubscription` renders when prices
 * are null (no `billing_plans` seed yet), one null (one cycle priced), or
 * both present — the three states a real deployment can be in.
 */
describe('selectAvailableCycles', () => {
  it('offers no cycles when both prices are null', () => {
    expect(selectAvailableCycles({ monthly_paise: null, annual_paise: null })).toEqual([]);
  });

  it('offers only annual when monthly is null', () => {
    expect(selectAvailableCycles({ monthly_paise: null, annual_paise: 499900 })).toEqual([
      { cycle: 'annual', paise: 499900 },
    ]);
  });

  it('offers only monthly when annual is null', () => {
    expect(selectAvailableCycles({ monthly_paise: 49900, annual_paise: null })).toEqual([
      { cycle: 'monthly', paise: 49900 },
    ]);
  });

  it('offers both, monthly first, when both prices are present', () => {
    expect(selectAvailableCycles({ monthly_paise: 49900, annual_paise: 499900 })).toEqual([
      { cycle: 'monthly', paise: 49900 },
      { cycle: 'annual', paise: 499900 },
    ]);
  });
});

/**
 * `canStartSubscribe` is the double-click guard extracted out of
 * `BillingPanel` so the one property that actually matters — while a
 * subscribe is in flight, no Subscribe button is clickable — can be proven
 * directly, rather than only inferred from reading the click handler. A
 * second click landing in this window used to mint a second Razorpay
 * payment mandate with its own idempotency key, charging the customer
 * twice; this is the test that would have caught it.
 */
describe('canStartSubscribe', () => {
  it('allows starting when nothing is in flight', () => {
    expect(canStartSubscribe(null)).toBe(true);
  });

  it('blocks every cycle once monthly is in flight, including monthly itself', () => {
    // The bug this guards against is not "clicking Subscribe monthly twice"
    // specifically — it is "any second click while one is in flight",
    // whichever button it lands on. So the check does not take the clicked
    // cycle as an argument: it has nothing to compare against, because the
    // answer is the same no matter which button was clicked.
    expect(canStartSubscribe('monthly')).toBe(false);
  });

  it('blocks every cycle once annual is in flight — a different cycle is not a different rule', () => {
    expect(canStartSubscribe('annual')).toBe(false);
  });
});
