'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { postAuth } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

export function CreateTenantForm({ resolverDomain }: { resolverDomain: string }) {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Puts a session that has no tenant into one the person already belongs to.
   *
   * Reachable two ways: a double submit, and an organisation being removed
   * underneath a live session. Both leave a real account with memberships and
   * no active tenant, which every tenant-scoped route refuses.
   */
  const enterExistingOrganisation = async (): Promise<void> => {
    const me = await fetch('/api/proxy/v1/auth/me').then((r) => (r.ok ? r.json() : null));
    const first = (me as { memberships?: { tenant: { id: string } }[] } | null)?.memberships?.[0];

    if (first === undefined) {
      setError('Could not find your organisation. Sign in again.');
      return;
    }

    const switched = await postAuth('switch', { tenant_id: first.tenant.id });
    if (!switched.ok) {
      setError('Could not open your organisation. Sign in again.');
      return;
    }
    router.replace('/codes');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Guard the handler, not just the button. `busy` reaches the button on the
    // next render, which is one paint too late for a double tap.
    if (busy) return;
    setBusy(true);
    setError(null);

    const created = await fetch('/api/proxy/v1/tenants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: slug.trim(), org_name: orgName.trim() }),
    });

    const payload = (await created.json().catch(() => ({}))) as {
      tenant?: { id: string };
      error?: { code?: string; message?: string };
    };

    if (!created.ok || payload.tenant === undefined) {
      setBusy(false);

      const code = payload.error?.code;
      if (code === 'slug_taken') {
        setError(`${slug} is taken. Pick another address.`);
        return;
      }
      if (code === 'org_name_taken') {
        setError(`An organisation called ${orgName} already exists.`);
        return;
      }
      if (code === 'already_owns_organisation') {
        /**
         * Almost always a double submit — two organisations called the same
         * thing appeared in production 24 seconds apart this way.
         *
         * Switching first, not just navigating: the session has no tenant
         * claim, so /codes would answer no_active_tenant and strand the person
         * on an error page for something that had already succeeded.
         */
        await enterExistingOrganisation();
        return;
      }

      setError(payload.error?.message ?? 'Could not create the organisation.');
      return;
    }

    // Switch before navigating. The tenant is a claim in the access token, so
    // without this the very next request answers no_active_tenant and a brand
    // new account lands on an error page.
    const switched = await postAuth('switch', { tenant_id: payload.tenant.id });
    setBusy(false);

    if (!switched.ok) {
      setError('Organisation created, but the session did not update. Sign in again.');
      return;
    }

    router.replace('/codes');
  };

  const slugValid = slug === '' || (slug.length >= 2 && SLUG_PATTERN.test(slug));

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org_name">Organisation name</Label>
        <Input
          id="org_name"
          required
          autoFocus
          value={orgName}
          onChange={(event) => {
            setOrgName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Address</Label>
        <Input
          id="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value.toLowerCase());
          }}
          {...(slugValid ? {} : { 'aria-invalid': true })}
        />
        <p className="text-muted-foreground text-xs">
          Your codes will resolve at{' '}
          <span className="text-foreground font-mono">
            {slug === '' ? 'your-org' : slug}.{resolverDomain}
          </span>
          . This becomes part of every printed QR code and cannot be changed afterwards.
        </p>
      </div>

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy || !slugValid || slug === ''}>
        {busy ? 'Creating…' : 'Create organisation'}
      </Button>
    </form>
  );
}
