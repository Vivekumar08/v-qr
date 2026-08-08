/**
 * Calls the console's own auth routes.
 *
 * Never the API directly: the tokens must be turned into httpOnly cookies
 * server-side, and that only happens in `/api/auth/*`.
 */

export interface AuthError {
  code: string;
  message: string;
  param?: string;
}

export interface AuthResult<T> {
  ok: boolean;
  data?: T;
  error?: AuthError;
}

export const postAuth = async <T>(
  action: 'login' | 'signup' | 'logout' | 'callback' | 'switch',
  body: Record<string, unknown> = {},
): Promise<AuthResult<T>> => {
  const response = await fetch(`/api/auth/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string; param?: string };
  } & Record<string, unknown>;

  if (response.ok) return { ok: true, data: payload as T };

  return {
    ok: false,
    error: {
      code: payload.error?.code ?? 'unknown_error',
      message: payload.error?.message ?? 'Something went wrong. Try again.',
      ...(payload.error?.param === undefined ? {} : { param: payload.error.param }),
    },
  };
};
