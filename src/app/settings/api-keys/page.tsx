import { AppShell } from '@/components/layout/AppShell';
import { ApiKeysPanel } from '@/features/apikeys/components/ApiKeysPanel';

export const metadata = { title: 'API keys · qr-infra' };

export default function ApiKeysPage() {
  return (
    <AppShell>
      <ApiKeysPanel />
    </AppShell>
  );
}
