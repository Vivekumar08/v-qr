import { AppShell } from '@/components/layout/AppShell';
import { TeamPanel } from '@/features/team/components/TeamPanel';

export const metadata = { title: 'Team · qr-infra' };

export default function TeamPage() {
  return (
    <AppShell>
      <TeamPanel />
    </AppShell>
  );
}
