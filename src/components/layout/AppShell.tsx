import Link from 'next/link';
import type { ReactNode } from 'react';
import { SideNav } from './SideNav';
import { ThemeToggle } from './ThemeToggle';
import { TenantSwitcher } from '@/features/team/components/TenantSwitcher';
import { UserMenu } from '@/features/auth/components/UserMenu';
import { VerifyBanner } from '@/features/auth/components/VerifyBanner';
import { ImpersonationBanner } from '@/features/admin/components/ImpersonationBanner';

/**
 * Server component — the only interactive parts are the nav's active state and
 * the theme toggle, both of which are their own client islands.
 *
 * A sidebar rather than a top bar: the navigation is about to hold codes,
 * analytics, team, API keys and billing, and a horizontal bar starts hiding
 * things at exactly the point someone is looking for them.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Above everything, including the sidebar. Someone inside a customer's
          account must see it whatever they scroll to. */}
      <ImpersonationBanner />
      <div className="flex min-h-0 flex-1">
      <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 border-r lg:flex lg:flex-col">
        <div className="flex h-14 items-center px-5">
          <Link href="/codes" className="font-heading text-[15px] font-bold tracking-tight">
            qr<span className="text-primary">·</span>infra
          </Link>
        </div>

        <SideNav />

        <div className="border-sidebar-border mt-auto border-t p-4">
          {/* Stated plainly and permanently. It is the promise the product is
              sold on, and the place someone checks when they are nervous. */}
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Printed codes resolve for as long as they exist. Destinations change;
            the label never does.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border/60 flex h-14 items-center gap-3 border-b px-5 lg:px-8">
          <Link href="/codes" className="font-heading font-bold lg:hidden">
            qr<span className="text-primary">·</span>infra
          </Link>
          <TenantSwitcher />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <VerifyBanner />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 lg:px-8">{children}</main>
      </div>
      </div>
    </div>
  );
}
