import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { VerifyEmailPanel } from '@/features/auth/components/VerifyEmailPanel';

export const metadata = { title: 'Confirm your email · qr-infra' };

export default function VerifyPage() {
  return (
    <AuthShell title="Confirm your email">
      <Suspense fallback={null}>
        <VerifyEmailPanel />
      </Suspense>
    </AuthShell>
  );
}
