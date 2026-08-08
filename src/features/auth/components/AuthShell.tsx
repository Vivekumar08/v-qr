import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The frame for every unauthenticated screen.
 *
 * Deliberately quiet: someone here is trying to get in, not to be sold to. The
 * one piece of product voice is the line under the card, because it is the
 * promise the whole thing rests on.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="font-heading mb-8 text-lg font-bold tracking-tight">
        qr<span className="text-primary">·</span>infra
      </Link>

      <div className="bg-card w-full max-w-sm rounded-2xl border p-7">
        <h1 className="font-heading text-xl font-bold tracking-tight">{title}</h1>
        {description !== undefined && (
          <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>

      {footer !== undefined && <div className="mt-6 text-sm">{footer}</div>}

      <p className="text-muted-foreground/70 mt-10 max-w-sm text-center text-xs leading-relaxed">
        Printed codes resolve for as long as they exist. Destinations change; the label never does.
      </p>
    </div>
  );
}
