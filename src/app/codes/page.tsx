import { AppShell } from '@/components/layout/AppShell';
import { CodesTable } from '@/features/codes/components/CodesTable';

export const metadata = { title: 'Codes · qr-infra' };

export default function CodesPage() {
  return (
    <AppShell>
      <CodesTable />
    </AppShell>
  );
}
