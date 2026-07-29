import Link from 'next/link';
import type { ReactNode } from 'react';

/** Server component — no interactivity, so no client bundle cost. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          <Link href="/codes" className="font-semibold tracking-tight">
            qr-infra
          </Link>
          <nav className="text-muted-foreground flex items-center gap-4 text-sm">
            <Link href="/codes" className="hover:text-foreground transition-colors">
              Codes
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
