import { AppShell } from '@/components/layout/AppShell';
import { TenantDetail } from '@/features/admin/components/TenantDetail';

export const metadata = { title: 'Organisation · qr-infra' };

/** Next 16 makes route params async. */
export default async function AdminTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <TenantDetail tenantId={id} />
    </AppShell>
  );
}
