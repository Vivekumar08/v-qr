'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QrCode, BarChart3, KeyRound, Users } from 'lucide-react';

/**
 * The active item is marked by a filled pill, not an underline.
 *
 * `Analytics`, `Team` and `API keys` are shown but disabled: they arrive with
 * identity and billing. Hiding them would make the console look finished and
 * leave someone hunting for a feature that is coming; showing them greyed says
 * what this is.
 */
const ITEMS = [
  { href: '/codes', label: 'Codes', icon: QrCode, ready: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, ready: false },
  { href: '/settings/team', label: 'Team', icon: Users, ready: false },
  { href: '/settings/api-keys', label: 'API keys', icon: KeyRound, ready: false },
] as const;

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-2">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;

        if (!item.ready) {
          return (
            <span
              key={item.href}
              className="text-muted-foreground/45 flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
              title="Coming with accounts and billing"
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
              <span className="ml-auto text-[10px] tracking-wide uppercase">Soon</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
