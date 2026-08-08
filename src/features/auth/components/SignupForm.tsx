'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { postAuth } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Mirrors the API's rule, so an invalid slug fails here rather than after a round trip. */
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

export function SignupForm({ resolverDomain = 'qr.example' }: { resolverDomain?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  /** True once the field is edited by hand — after that we stop guessing. */
  const [slugEdited, setSlugEdited] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onOrgNameChange = (value: string) => {
    setOrgName(value);
    // Suggested, never imposed: the field is visible and editable, and the
    // request sends exactly what is shown.
    if (!slugEdited) setSlug(slugify(value));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError(null);

    const result = await postAuth('signup', {
      email: email.trim(),
      password,
      name: name.trim(),
      org_name: orgName.trim(),
      slug: slug.trim(),
    });

    setBusy(false);

    if (!result.ok) {
      const code = result.error?.code;
      if (code === 'email_taken') {
        setFieldError({ field: 'email', message: 'An account with that email already exists.' });
        return;
      }
      if (code === 'slug_taken') {
        setFieldError({ field: 'slug', message: `${slug} is taken. Pick another address.` });
        return;
      }
      if (result.error?.param !== undefined) {
        setFieldError({ field: result.error.param, message: result.error.message });
        return;
      }
      setError(result.error?.message ?? 'Something went wrong.');
      return;
    }

    router.replace('/codes');
  };

  const slugValid = slug === '' || (slug.length >= 2 && SLUG_PATTERN.test(slug));

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          {...(fieldError?.field === 'email' ? { 'aria-invalid': true } : {})}
        />
        {fieldError?.field === 'email' && (
          <p className="text-destructive text-sm">{fieldError.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          {...(fieldError?.field === 'password' ? { 'aria-invalid': true } : {})}
        />
        <p className="text-muted-foreground text-xs">
          At least 12 characters. Length beats punctuation.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="org_name">Organisation</Label>
        <Input
          id="org_name"
          required
          value={orgName}
          onChange={(event) => onOrgNameChange(event.target.value)}
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
          {...(fieldError?.field === 'slug' || !slugValid ? { 'aria-invalid': true } : {})}
        />
        {/* The one irreversible field on this screen, so it says so. */}
        <p className="text-muted-foreground text-xs">
          Your codes will resolve at{' '}
          <span className="text-foreground font-mono">
            {slug === '' ? 'your-org' : slug}.{resolverDomain}
          </span>
          . This becomes part of every printed QR code and cannot be changed afterwards.
        </p>
        {fieldError?.field === 'slug' && (
          <p className="text-destructive text-sm">{fieldError.message}</p>
        )}
        {!slugValid && (
          <p className="text-destructive text-sm">
            Use lowercase letters, numbers and hyphens, at least two characters.
          </p>
        )}
      </div>

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy || !slugValid}>
        {busy ? 'Creating…' : 'Create account'}
      </Button>
    </form>
  );
}
