import { vi } from 'vitest';
import { requirementFor } from './apiContract';

/**
 * A stand-in for the API that enforces the contract rather than agreeing with
 * whatever the caller does.
 *
 * The point is the 401: a `session` endpoint reached without an Authorization
 * header answers exactly as the real API would, so a console route that
 * forgets to forward the credential fails the test instead of shipping.
 */

export interface StubCall {
  method: string;
  path: string;
  authorization: string | null;
  body: Record<string, unknown>;
}

export interface ApiStub {
  calls: StubCall[];
  /** Queue a response for the next matching path. Otherwise a default is used. */
  reply(path: string, response: { status: number; body?: unknown }): void;
  install(): void;
}

const TOKENS = { access_token: 'stub-access', refresh_token: 'rt_stub' };

export const createApiStub = (base = 'http://127.0.0.1:8787'): ApiStub => {
  const calls: StubCall[] = [];
  const queued = new Map<string, { status: number; body?: unknown }[]>();

  const stub = {
    calls,

    reply: (path: string, response: { status: number; body?: unknown }) => {
      const existing = queued.get(path) ?? [];
      existing.push(response);
      queued.set(path, existing);
    },

    install: () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string | URL, init: RequestInit = {}) => {
          const full = String(url);
          const path = full.replace(base, '').split('?')[0]!;
          const method = (init.method ?? 'GET').toUpperCase();
          const authorization = new Headers(init.headers).get('authorization');

          let body: Record<string, unknown> = {};
          if (typeof init.body === 'string' && init.body !== '') {
            body = JSON.parse(init.body) as Record<string, unknown>;
          }

          calls.push({ method, path, authorization, body });

          // The contract, enforced.
          if (requirementFor(method, path) === 'session' && authorization === null) {
            return new Response(
              JSON.stringify({
                error: {
                  type: 'authentication',
                  code: 'missing_api_key',
                  message: 'Provide an access token or API key as a Bearer token.',
                },
              }),
              { status: 401, headers: { 'content-type': 'application/json' } },
            );
          }

          const next = queued.get(path)?.shift();
          if (next !== undefined) {
            return new Response(next.body === undefined ? '{}' : JSON.stringify(next.body), {
              status: next.status,
              headers: { 'content-type': 'application/json' },
            });
          }

          // Endpoints that mint a session answer with a token pair; the rest
          // answer with something harmless.
          const mintsSession =
            path.endsWith('/login') ||
            path.endsWith('/signup') ||
            path.endsWith('/switch') ||
            path.endsWith('/refresh') ||
            path.endsWith('/session/exchange');

          return new Response(
            JSON.stringify(mintsSession ? { tokens: TOKENS, active_tenant_id: null } : { data: [] }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }),
      );
    },
  };

  return stub;
};
