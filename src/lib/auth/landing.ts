/**
 * Where a freshly-signed-in session belongs.
 *
 * Shared by the password form and the Google callback, because they answered
 * this question separately and one of them was always going to drift.
 *
 * The case that forced this to exist: a platform operator has no organisation
 * of their own, deliberately — the admin routes carry `requireTenant: false`
 * precisely so an operator can reach them without one. But "no active tenant"
 * was read as "needs onboarding", so operators were parked on a form asking
 * them to name an organisation they must not create, with no route out of it.
 * The operator console was unreachable through the UI while every underlying
 * endpoint worked perfectly.
 */

export const landingFor = ({
  activeTenantId,
  isSuperAdmin,
  next,
}: {
  activeTenantId: string | null;
  isSuperAdmin: boolean;
  /** A `?next=` the user was headed for before being asked to sign in. */
  next?: string | null;
}): string => {
  // Belonging to an organisation wins. An operator who also owns a tenant is a
  // normal user of it, and gets there by the same door as everyone else.
  if (activeTenantId !== null) return next ?? '/codes';

  // No tenant, but a place to be.
  if (isSuperAdmin) return '/admin';

  // No tenant and no operator rights: the only screen that can fix that. Every
  // Google signup starts here, and a password account reaches it by leaving its
  // last team.
  return '/onboarding';
};

/**
 * Asks the API whether this session belongs to an operator.
 *
 * Only worth calling when there is no active tenant — the answer changes
 * nothing otherwise, and it is one request on a path taken once per sign-in.
 * Any failure answers `false`: being sent to onboarding is recoverable, and
 * guessing `true` would strand an ordinary user on a 404.
 *
 * `accessToken` is for server-side callers talking to the API directly. From
 * the browser it is omitted and the proxy supplies the credential from the
 * cookies — it does not forward an Authorization header from the client, so
 * sending one would be discarded anyway.
 */
export const isOperator = async (meUrl: string, accessToken?: string): Promise<boolean> => {
  const response = await fetch(meUrl, {
    ...(accessToken === undefined ? {} : { headers: { authorization: `Bearer ${accessToken}` } }),
    cache: 'no-store',
  }).catch(() => null);

  if (response === null || !response.ok) return false;

  const body = (await response.json().catch(() => ({}))) as { is_super_admin?: boolean };
  return body.is_super_admin === true;
};
