import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ForgotForm } from '@/features/auth/components/ForgotForm';

export const metadata = { title: 'Reset your password · qr-infra' };

export default function ForgotPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="We will email a link if that address has an account."
      footer={
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
