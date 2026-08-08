'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, LogOut, Users } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { qrInfraApi, useMeQuery } from '@/lib/api/qrInfraApi';
import { postAuth } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { data } = useMeQuery();

  const signOut = async () => {
    await postAuth('logout');
    // Cleared so a different account signing in next cannot momentarily see
    // the previous one's data from cache.
    dispatch(qrInfraApi.util.resetApiState());
    router.replace('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <span className="max-w-40 truncate">{data?.user.name ?? 'Account'}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{data?.user.name}</p>
          <p className="text-muted-foreground truncate text-xs">{data?.user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings/team" />}>
          <Users className="size-4" aria-hidden />
          Team
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/api-keys" />}>
          <KeyRound className="size-4" aria-hidden />
          API keys
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
