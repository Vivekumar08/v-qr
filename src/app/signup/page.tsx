import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { GoogleButton } from '@/features/auth/components/GoogleButton';
import { SignupForm } from '@/features/auth/components/SignupForm';
import { Separator } from '@/components/ui/separator';

export const metadata = { title: 'Create an account · qr-infra' };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create an account"
      description="Codes you print today keep resolving for as long as they exist."
      footer={
        <p className="text-muted-foreground">
          Already have one?{' '}
          <Link href="/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <GoogleButton label="Sign up with Google" />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">or</span>
          <Separator className="flex-1" />
        </div>

        <SignupForm resolverDomain={process.env.RESOLVER_DOMAIN ?? 'qr.example'} />
      </div>
    </AuthShell>
  );
}
