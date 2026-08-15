'use client';

import { useSyncExternalStore } from 'react';
import { IMPERSONATION_LABEL_COOKIE } from '@/lib/auth/cookies';

/**
 * The tenant currently being viewed as an operator, or `null`.
 *
 * The label cookie is readable on purpose; the token beside it is httpOnly and
 * never reaches the browser. Read through `useSyncExternalStore` rather than an
 * effect so the server and the first client render agree — a banner that
 * appears one paint late is a banner somebody can act before seeing.
 */
const read = (): string | null => {
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${IMPERSONATION_LABEL_COOKIE}=`));

  if (match === undefined) return null;
  const value = decodeURIComponent(match.split('=')[1] ?? '');
  return value === '' ? null : value;
};

/** Cookies emit no events, and this one only changes on a full page load. */
const subscribe = (): (() => void) => () => undefined;

export const useImpersonation = (): string | null =>
  useSyncExternalStore(subscribe, read, () => null);
