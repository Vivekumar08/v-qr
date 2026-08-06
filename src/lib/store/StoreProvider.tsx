'use client';

import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from './store';

/**
 * Creates the store once per client instance.
 *
 * A lazy `useState` initialiser rather than a module constant: under React
 * strict mode the component body runs twice, and building the store inline
 * would discard the first one along with any in-flight queries. A module-level
 * store would be worse still — it would be shared across requests on the
 * server, leaking one visitor's cache into another's render.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
