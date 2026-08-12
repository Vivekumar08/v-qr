import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: 'Audit log · qr-infra' };

export default function AuditPage() {
  return (
    <AppShell>
      {/* `useSearchParams` opts the subtree into client rendering and needs a
          boundary; without one the whole route bails out of prerendering. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AuditTable />
      </Suspense>
    </AppShell>
  );
}
