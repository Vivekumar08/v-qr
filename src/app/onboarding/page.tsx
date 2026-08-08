import { AuthShell } from '@/features/auth/components/AuthShell';
import { CreateTenantForm } from '@/features/auth/components/CreateTenantForm';

export const metadata = { title: 'Create your organisation · qr-infra' };

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Create your organisation"
      description="One more step. This decides the address your printed codes resolve at."
    >
      <CreateTenantForm resolverDomain={process.env.RESOLVER_DOMAIN ?? 'qr.example'} />
    </AuthShell>
  );
}
