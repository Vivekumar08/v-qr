'use client';

import { useState, useSyncExternalStore } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMPERSONATION_LABEL_COOKIE } from '@/lib/auth/cookies';

/**
 * Impossible to miss, and impossible to leave running by accident.
 *
 * An operator who forgets they are inside somebody else's account is the
 * failure mode worth designing against: every screen below this looks exactly
 * like their own console. So the banner is fixed to the top of the viewport,
 * uses the one colour nothing else in the interface uses, and says whose
 * account it is rather than that a mode is on.
 *
 * The API refuses every write from an impersonation token, so this is a label
 * for a rule already enforced — not the rule itself.
 */
/**
 * The label cookie is readable on purpose; the token beside it is httpOnly and
 * never reaches this component.
 *
 * Read through `useSyncExternalStore` rather than an effect so the server and
 * the first client render agree — the server has no `document`, and a banner
 * that appears one paint late is a banner somebody can act before seeing.
 */
const readTenant = (): string | null => {
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${IMPERSONATION_LABEL_COOKIE}=`));

  if (match === undefined) return null;
  const value = decodeURIComponent(match.split('=')[1] ?? '');
  return value === '' ? null : value;
};

/** Cookies emit no events, and this one only changes on a full page load. */
const subscribe = (): (() => void) => () => undefined;

export function ImpersonationBanner() {
  const tenant = useSyncExternalStore(subscribe, readTenant, () => null);
  const [leaving, setLeaving] = useState(false);

  if (tenant === null) return null;

  const exit = async () => {
    setLeaving(true);
    await fetch('/api/admin/impersonate', { method: 'DELETE' });
    // A full reload, not a soft navigation: every cached RTK Query result
    // belongs to the customer's account and none of it is the operator's.
    // router.push would keep that store intact and show one account's codes
    // under the other's name.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- discarding the store is the point
    window.location.assign('/admin');
  };

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-3 bg-amber-500 px-5 py-2 text-sm text-amber-950 lg:px-8"
    >
      <Eye className="size-4 shrink-0" aria-hidden />
      <p>
        Viewing <span className="font-mono font-semibold">{tenant}</span> as an operator. Read-only —
        nothing you do here can change their account.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto border-amber-900/30 bg-amber-100 text-amber-950 hover:bg-amber-50"
        disabled={leaving}
        onClick={() => void exit()}
      >
        {leaving ? 'Leaving…' : 'Exit'}
      </Button>
    </div>
  );
}
