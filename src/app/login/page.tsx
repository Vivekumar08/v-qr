import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { GoogleButton } from '@/features/auth/components/GoogleButton';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { Separator } from '@/components/ui/separator';

export const metadata = { title: 'Sign in · qr-infra' };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      footer={
        <p className="text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="text-foreground hover:underline">
            Create one
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <GoogleButton label="Sign in with Google" />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">or</span>
          <Separator className="flex-1" />
        </div>

        {/* useSearchParams needs a boundary, or the whole route opts out of
            prerendering. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
