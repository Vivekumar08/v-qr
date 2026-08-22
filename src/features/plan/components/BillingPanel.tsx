'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useMeQuery,
  useBillingQuery,
  usePlanQuery,
  useSubscribeMutation,
  useCancelSubscriptionMutation,
} from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { BillingCycle, BillingState } from '@/lib/api/types';
import { canStartSubscribe, selectAvailableCycles } from '@/features/plan/billing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Razorpay Checkout's runtime surface, typed just enough for what this panel
 * calls. We do not depend on Razorpay's own type package for one component
 * and a handful of fields.
 */
interface RazorpayCheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: () => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

const CHECKOUT_SCRIPT_ID = 'razorpay-checkout';

/**
 * Loaded on demand, once.
 *
 * Razorpay's Checkout script is the only external script this console loads.
 * Putting it in the root layout would ship it to every page for the benefit
 * of one, and a payment provider's script on the sign-in page is a wider
 * blast radius than it needs.
 */
const loadCheckout = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.getElementById(CHECKOUT_SCRIPT_ID) !== null) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = CHECKOUT_SCRIPT_ID;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment form.'));
    document.body.appendChild(script);
  });

const CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
};

const CYCLE_PERIOD: Record<BillingCycle, string> = {
  monthly: 'month',
  annual: 'year',
};

/** Amounts are integer paise on the wire; this is the only place they are divided. */
const formatPaise = (paise: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);

const formatDate = (iso: string | null): string =>
  iso === null ? '—' : new Date(iso).toLocaleDateString();

export function BillingPanel() {
  const { data: me } = useMeQuery();
  const role = me?.memberships.find((m) => m.tenant.id === me.active_tenant_id)?.role;
  const isOwner = role === 'owner';

  // Skipped rather than unconditionally fetched: an admin's request would
  // 403 anyway, and there is nothing useful to show them from the result.
  const { data, isLoading, error, refetch: refetchBilling } = useBillingQuery(undefined, {
    skip: !isOwner,
  });
  const { refetch: refetchPlan } = usePlanQuery(undefined, { skip: !isOwner });
  const [subscribe, { isLoading: isSubscribing }] = useSubscribeMutation();
  const [cancelSubscription, { isLoading: isCancelling }] = useCancelSubscriptionMutation();
  const [startingCycle, setStartingCycle] = useState<BillingCycle | null>(null);

  // Nothing renders for anyone but the owner, matching the API: subscribe and
  // cancel both 403 for an admin, and a button that always fails is worse
  // than no button at all.
  if (!isOwner) return null;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (error !== undefined) {
    const { message, requestId } = normaliseError(error);
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">Could not load billing</p>
        <p className="text-muted-foreground mt-1 text-sm">{message}</p>
        {requestId !== undefined && (
          <p className="text-muted-foreground mt-2 font-mono text-xs">Request {requestId}</p>
        )}
      </div>
    );
  }

  if (data === undefined) return null;

  const onSubscribe = async (cycle: BillingCycle) => {
    // Set synchronously, before the first `await`. A double-click — the same
    // button twice, or monthly then annual — must not be able to land a
    // second `subscribe()` call: each dispatch mints its own fresh
    // idempotency key, so two calls in flight are two Razorpay payment
    // mandates and a customer charged twice, not one deduped request. Every
    // subsequent line in this function is asynchronous, so this is the only
    // place the race can be closed.
    if (!canStartSubscribe(startingCycle)) return;
    setStartingCycle(cycle);
    try {
      await loadCheckout();
      const { subscription_id, key_id } = await subscribe(cycle).unwrap();

      if (window.Razorpay === undefined) {
        throw new Error('Could not load the payment form.');
      }

      const checkout = new window.Razorpay({
        key: key_id,
        subscription_id,
        name: 'qr-infra',
        description: `${CYCLE_LABEL[cycle]} plan`,
        handler: () => {
          // Reaching this callback only means the browser came back from
          // Checkout — it is not proof of payment. Razorpay confirms
          // asynchronously over the signed webhook, and `syncSubscription` on
          // the backend is what actually moves the plan. So we refetch and
          // let the server be the truth, rather than trusting this callback.
          void refetchBilling();
          void refetchPlan();
          toast.success('Payment submitted', {
            description: 'Your plan updates once the payment is confirmed — usually within a minute.',
          });
        },
      });
      checkout.open();
    } catch (err) {
      toast.error('Could not start checkout', { description: normaliseError(err).message });
    } finally {
      setStartingCycle(null);
    }
  };

  const onCancel = async () => {
    if (
      !window.confirm('Cancel your subscription? Access continues until the current period ends.')
    ) {
      return;
    }
    try {
      await cancelSubscription().unwrap();
      toast.success('Cancellation requested');
    } catch (err) {
      toast.error('Could not cancel', { description: normaliseError(err).message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>
          {data.subscription === null
            ? 'Subscribe to unlock a paid plan.'
            : 'Manage your subscription.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.subscription === null ? (
          <NoSubscription
            prices={data.prices}
            onSubscribe={(cycle) => void onSubscribe(cycle)}
            startingCycle={startingCycle}
            isSubscribing={isSubscribing}
          />
        ) : (
          <ActiveSubscription
            subscription={data.subscription}
            onCancel={() => void onCancel()}
            isCancelling={isCancelling}
          />
        )}
      </CardContent>
    </Card>
  );
}

function NoSubscription({
  prices,
  onSubscribe,
  startingCycle,
  isSubscribing,
}: {
  prices: BillingState['prices'];
  onSubscribe: (cycle: BillingCycle) => void;
  startingCycle: BillingCycle | null;
  isSubscribing: boolean;
}) {
  const cycles = selectAvailableCycles(prices);

  if (cycles.length === 0) {
    // Production has zero `billing_plans` rows until the seed runs, so this
    // is the state a real owner hits first. Rendering "₹null" or a button
    // that would 400 is worse than saying plainly that billing isn't on yet.
    return (
      <p className="text-muted-foreground text-sm">
        Billing is not available yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cycles.map(({ cycle, paise }) => (
        <div key={cycle} className="space-y-3 rounded-lg border p-4">
          <div>
            <p className="font-medium">{CYCLE_LABEL[cycle]}</p>
            <p className="text-2xl font-semibold">
              {formatPaise(paise)}
              <span className="text-muted-foreground text-sm font-normal">
                {' '}
                / {CYCLE_PERIOD[cycle]}
              </span>
            </p>
          </div>
          <Button
            className="w-full"
            // Not just `startingCycle === cycle`: the other cycle's button
            // must also go dead while one subscribe is in flight, or a user
            // can start monthly then click annual and mint two mandates for
            // two different plans — the same double-charge bug, just across
            // cycles instead of across clicks on one button.
            disabled={isSubscribing || !canStartSubscribe(startingCycle)}
            onClick={() => onSubscribe(cycle)}
          >
            {startingCycle === cycle ? 'Starting…' : `Subscribe ${CYCLE_LABEL[cycle].toLowerCase()}`}
          </Button>
        </div>
      ))}
    </div>
  );
}

function ActiveSubscription({
  subscription,
  onCancel,
  isCancelling,
}: {
  subscription: NonNullable<BillingState['subscription']>;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge>{subscription.status}</Badge>
        <span className="text-muted-foreground text-sm">{CYCLE_LABEL[subscription.cycle]}</span>
      </div>

      {subscription.cancel_requested ? (
        <p className="text-muted-foreground text-sm">
          Your subscription ends on {formatDate(subscription.current_end)}. Codes you have already
          printed keep resolving after that — cancelling billing never breaks a code already in
          the world.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Renews {formatDate(subscription.current_end)}.
          </p>
          <Button variant="outline" onClick={onCancel} disabled={isCancelling}>
            {isCancelling ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
        </>
      )}
    </div>
  );
}
