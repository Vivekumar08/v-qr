'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import {
  useCreateApiKeyMutation,
  useListApiKeysQuery,
  useMeQuery,
  useRevokeApiKeyMutation,
} from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import type { ApiKeySummary } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const SCOPES = [
  { value: 'codes:read', label: 'Read codes' },
  { value: 'codes:write', label: 'Create and repoint codes' },
  { value: 'scans:read', label: 'Read scan counts' },
  { value: 'admin', label: 'Everything', ownerOnly: true },
] as const;

export function ApiKeysPanel() {
  const { data: me } = useMeQuery();
  const { data, isLoading } = useListApiKeysQuery();

  const myRole = me?.memberships.find((m) => m.tenant.id === me.active_tenant_id)?.role ?? 'member';

  if (myRole === 'member') {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">API keys need admin access</p>
        <p className="text-muted-foreground mt-1 text-sm">
          A key outlives the session that made it, so only an owner or admin can create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">API keys</h1>
        <p className="text-muted-foreground text-sm">
          For your own integrations. A key can never carry more access than the person who made it.
        </p>
      </div>

      <CreateKeyCard isOwner={myRole === 'owner'} />

      <Card>
        <CardHeader>
          <CardTitle>Active keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">No keys yet.</p>
          ) : (
            (data?.data ?? []).map((key) => <KeyRow key={key.id} apiKey={key} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateKeyCard({ isOwner }: { isOwner: boolean }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['codes:read']);
  const [created, setCreated] = useState<string | null>(null);
  const [createKey, { isLoading }] = useCreateApiKeyMutation();

  const toggle = (scope: string) =>
    setScopes((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await createKey({ name: name.trim(), scopes }).unwrap();
      setCreated(result.key);
      setName('');
      toast.success('Key created');
    } catch (error) {
      toast.error('Could not create the key', { description: normaliseError(error).message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a key</CardTitle>
        <CardDescription>Shown once. It is not stored and cannot be shown again.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key-name">What is it for?</Label>
            <Input
              id="key-name"
              required
              placeholder="Label printer, CI, warehouse sync"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Access</legend>
            {SCOPES.filter((scope) => !('ownerOnly' in scope) || isOwner).map((scope) => (
              <label key={scope.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope.value)}
                  onChange={() => toggle(scope.value)}
                />
                {scope.label}
                <code className="text-muted-foreground font-mono text-xs">{scope.value}</code>
              </label>
            ))}
          </fieldset>

          <Button type="submit" disabled={isLoading || name.trim() === '' || scopes.length === 0}>
            {isLoading ? 'Creating…' : 'Create key'}
          </Button>
        </form>

        {created !== null && (
          <div className="border-primary/30 bg-primary/5 space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Copy this now.</p>
            <p className="text-muted-foreground text-xs">
              Only a hash is stored, so there is no way to show it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{created}</code>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(created);
                  toast.success('Key copied');
                }}
              >
                <Copy className="size-3" aria-hidden />
                Copy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KeyRow({ apiKey }: { apiKey: ApiKeySummary }) {
  const [revoke, { isLoading }] = useRevokeApiKeyMutation();

  const onRevoke = () => {
    // Immediate and irreversible for anything using it, so the confirmation
    // names the key and says what breaks.
    if (
      !window.confirm(
        `Revoke "${apiKey.name}"? Any integration using it stops working immediately.`,
      )
    ) {
      return;
    }

    void revoke(apiKey.id)
      .unwrap()
      .then(() => toast.success(`${apiKey.name} revoked`))
      .catch((error: unknown) =>
        toast.error('Could not revoke the key', { description: normaliseError(error).message }),
      );
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{apiKey.name}</p>
        <p className="text-muted-foreground font-mono text-xs">{apiKey.prefix}…</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {apiKey.scopes.map((scope) => (
          <Badge key={scope} variant="secondary" className="font-mono text-[10px]">
            {scope}
          </Badge>
        ))}
      </div>

      <p className="text-muted-foreground w-28 text-xs">
        {apiKey.last_used_at === null
          ? 'Never used'
          : `Used ${new Date(apiKey.last_used_at).toLocaleDateString()}`}
      </p>

      <Button size="xs" variant="ghost" disabled={isLoading} onClick={onRevoke}>
        Revoke
      </Button>
    </div>
  );
}
