import { AppShell } from '@/components/layout/AppShell';
import { UsageCard } from '@/features/plan/components/UsageCard';

export const metadata = { title: 'Plan · qr-infra' };

export default function PlanPage() {
  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Plan and usage</h1>
        <UsageCard />
      </div>
    </AppShell>
  );
}
