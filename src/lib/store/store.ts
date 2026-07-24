import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { qrInfraApi } from '../api/qrInfraApi';

/**
 * A factory rather than a module-level singleton.
 *
 * A shared store instance would be reused across requests on the server and
 * leak one user's cached data into another's render. Each request gets its own.
 */
export const makeStore = () => {
  const store = configureStore({
    reducer: { [qrInfraApi.reducerPath]: qrInfraApi.reducer },
    middleware: (getDefault) => getDefault().concat(qrInfraApi.middleware),
  });

  // Refetch on reconnect and on window focus.
  setupListeners(store.dispatch);
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
