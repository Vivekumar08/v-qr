'use client';

import { useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from './store';

/**
 * Creates the store once per client instance.
 *
 * `useRef` rather than a module constant: under React strict mode the component
 * body runs twice, and building the store inline would discard the first one
 * along with any in-flight queries.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  storeRef.current ??= makeStore();

  return <Provider store={storeRef.current}>{children}</Provider>;
}
