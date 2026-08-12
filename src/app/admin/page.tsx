import { AppShell } from '@/components/layout/AppShell';
import { TenantList } from '@/features/admin/components/TenantList';

export const metadata = { title: 'Organisations · qr-infra' };

export default function AdminPage() {
  return (
    <AppShell>
      <TenantList />
    </AppShell>
  );
}
