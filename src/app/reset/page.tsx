import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ResetForm } from '@/features/auth/components/ResetForm';

export const metadata = { title: 'Choose a new password · qr-infra' };

export default function ResetPage() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
