/**
 * Which API endpoints require a session, from the console's point of view.
 *
 * This exists because three production bugs in a row lived in the seam between
 * the console and the API, and neither side's tests could see them: the API's
 * tests supply the Authorization header themselves, and the console's mock
 * `fetch` wholesale. Both suites were green while password reset, Google
 * sign-in and organisation switching were all broken.
 *
 * The stub built from this table refuses a `session` request that arrives
 * without a credential, exactly as the real API does — so a console route that
 * forgets to forward one fails here instead of in production.
 *
 * DRIFT WARNING: this is hand-maintained and cannot detect the API changing
 * underneath it. It catches the console disagreeing with what the API required
 * at the time of writing, which is the failure that has actually happened three
 * times. It does not replace running against a real backend.
 */
export type AuthRequirement = 'public' | 'session';

export const API_CONTRACT: Record<string, AuthRequirement> = {
  // Public by necessity — these are how a session begins, or what you reach
  // for precisely because you cannot sign in.
  'POST /v1/auth/signup': 'public',
  'POST /v1/auth/login': 'public',
  'POST /v1/auth/logout': 'public',
  'POST /v1/auth/refresh': 'public',
  'GET /v1/auth/google/start': 'public',
  'POST /v1/auth/session/exchange': 'public',
  'POST /v1/auth/password/forgot': 'public',
  'POST /v1/auth/password/reset': 'public',
  'POST /v1/auth/email/verify': 'public',

  // Everything else needs a signed-in user.
  'POST /v1/auth/email/resend': 'session',
  'GET /v1/auth/me': 'session',
  'POST /v1/auth/switch': 'session',
  'POST /v1/tenants': 'session',
  'POST /v1/invites/accept': 'session',
  'GET /v1/invites': 'session',
  'POST /v1/invites': 'session',
  'GET /v1/members': 'session',
  'GET /v1/api-keys': 'session',
  'POST /v1/api-keys': 'session',
  'GET /v1/codes': 'session',
  'POST /v1/codes': 'session',
  'GET /v1/codes/export': 'session',
  'GET /v1/plan': 'session',

  // The operator surface. `session` understates it — these also demand an
  // address on the super-admin allow-list, and answer 404 rather than 403 to
  // everyone else. The stub only models the credential, which is enough to
  // catch the console failing to forward one.
  'GET /v1/admin/tenants': 'session',
  'GET /v1/admin/audit': 'session',
};

/** Matches a concrete request against the table, tolerating path parameters. */
export const requirementFor = (method: string, path: string): AuthRequirement | undefined => {
  const direct = API_CONTRACT[`${method} ${path}`];
  if (direct !== undefined) return direct;

  // /v1/codes/{id}, /v1/members/{id}, /v1/invites/{id} and their sub-paths all
  // sit behind the same guard as their collection.
  for (const prefix of [
    '/v1/codes/',
    '/v1/members/',
    '/v1/invites/',
    '/v1/api-keys/',
    // Covers /v1/admin/tenants/{id}, its sub-paths, and the action endpoints.
    '/v1/admin/',
  ]) {
    if (path.startsWith(prefix)) return 'session';
  }
  return undefined;
};
