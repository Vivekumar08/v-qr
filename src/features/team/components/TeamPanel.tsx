'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import {
  useChangeMemberRoleMutation,
  useCreateInviteMutation,
  useListInvitesQuery,
  useListMembersQuery,
  useMeQuery,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
  useTransferOwnershipMutation,
  usePlanQuery,
} from '@/lib/api/qrInfraApi';
import { normaliseError } from '@/lib/api/errors';
import { isLimitReached } from '@/features/plan/limits';
import type { Member, Role } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

/** What each role can do, shown against the row it applies to. */
const ROLE_MEANING: Record<Role, string> = {
  owner: 'Everything, including billing and ownership transfer',
  admin: 'Codes, destinations, API keys and invitations',
  member: 'Codes and destinations',
};

export function TeamPanel() {
  const { data: me } = useMeQuery();
  const { data: members, isLoading } = useListMembersQuery();
  const { data: invites } = useListInvitesQuery();

  const myRole = me?.memberships.find((m) => m.tenant.id === me.active_tenant_id)?.role ?? 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-muted-foreground text-sm">
          Everyone here can change where your printed codes lead.
        </p>
      </div>

      {canManage && <InviteCard />}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {/* Whose permissions these are was ambiguous when this described
                the viewer's own role; it now describes the list. */}
            {members?.data.length ?? 0} in this organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            (members?.data ?? []).map((member) => (
              <MemberRow
                key={member.user_id}
                member={member}
                canManage={canManage}
                isOwner={myRole === 'owner'}
                isSelf={member.user_id === me?.user.id}
              />
            ))
          )}
        </CardContent>
      </Card>

      {canManage && (invites?.data.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Each expires seven days after it was sent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(invites?.data ?? []).map((invite) => (
              <PendingInvite key={invite.id} id={invite.id} email={invite.email} role={invite.role} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InviteCard() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [link, setLink] = useState<string | null>(null);
  const [createInvite, { isLoading }] = useCreateInviteMutation();
  const { data: plan } = usePlanQuery();

  const seatsFull = plan !== undefined && isLimitReached(plan.usage.seats, plan.limits.seats);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await createInvite({ email: email.trim(), role }).unwrap();
      setLink(result.link);
      setEmail('');
      toast.success(`Invitation sent to ${result.invite.email}`);
    } catch (error) {
      toast.error('Could not send the invitation', {
        description: normaliseError(error).message,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone</CardTitle>
        <CardDescription>
          The invitation is bound to this address — forwarding the link will not let someone else in.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-wrap gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="w-40 space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="self-end"
            disabled={isLoading || email.trim() === '' || seatsFull}
          >
            {seatsFull ? 'Seat limit reached' : isLoading ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>

        {seatsFull && (
          <p className="text-muted-foreground text-xs">
            {plan.usage.seats} of {plan.limits.seats} seats used on the {plan.plan} plan. A
            pending invite holds a seat — revoking one frees it.
          </p>
        )}

        {link !== null && (
          <div className="bg-muted/40 space-y-2 rounded-lg border p-3">
            {/* The mitigation for sending through a personal mailbox: if the
                mail is throttled or lands in spam, the link still exists. */}
            <p className="text-muted-foreground text-xs">
              We emailed this link. If it does not arrive, copy it and send it yourself.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success('Link copied');
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

function MemberRow({
  member,
  canManage,
  isOwner,
  isSelf,
}: {
  member: Member;
  canManage: boolean;
  isOwner: boolean;
  isSelf: boolean;
}) {
  const [changeRole] = useChangeMemberRoleMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [transferOwnership] = useTransferOwnershipMutation();

  const act = async (run: () => Promise<unknown>, success: string) => {
    try {
      await run();
      toast.success(success);
    } catch (error) {
      const { message } = normaliseError(error);
      toast.error(message);
    }
  };

  const onRemove = () => {
    if (!window.confirm(`Remove ${member.email} from this organisation?`)) return;
    void act(
      () => removeMember(member.user_id).unwrap(),
      `${member.email} removed. Their sessions have been ended.`,
    );
  };

  const onTransfer = () => {
    // Irreversible without the other person's cooperation, so it is spelled out.
    if (
      !window.confirm(
        `Make ${member.email} the owner? You will become an admin and cannot undo this yourself.`,
      )
    ) {
      return;
    }
    void act(() => transferOwnership(member.user_id).unwrap(), `${member.email} is now the owner`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name}
          {isSelf && <span className="text-muted-foreground text-xs"> · you</span>}
        </p>
        <p className="text-muted-foreground truncate text-xs">{member.email}</p>
        <p className="text-muted-foreground/70 mt-0.5 truncate text-[11px]">
          {ROLE_MEANING[member.role]}
        </p>
      </div>

      {member.role === 'owner' || !canManage ? (
        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>{member.role}</Badge>
      ) : (
        <Select
          value={member.role}
          onValueChange={(value) =>
            void act(
              () => changeRole({ userId: member.user_id, role: value as Role }).unwrap(),
              `${member.email} is now ${value}`,
            )
          }
        >
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      )}

      {canManage && !isSelf && member.role !== 'owner' && (
        <div className="flex gap-1">
          {isOwner && (
            <Button size="xs" variant="ghost" onClick={onTransfer}>
              Make owner
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

function PendingInvite({ id, email, role }: { id: string; email: string; role: Role }) {
  const [revokeInvite, { isLoading }] = useRevokeInviteMutation();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{email}</p>
        <p className="text-muted-foreground text-xs">Invited as {role}</p>
      </div>
      <Button
        size="xs"
        variant="ghost"
        disabled={isLoading}
        onClick={() => {
          void revokeInvite(id)
            .unwrap()
            .then(() => toast.success('Invitation revoked'))
            .catch(() => toast.error('Could not revoke that invitation'));
        }}
      >
        Revoke
      </Button>
    </div>
  );
}
