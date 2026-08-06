import { AppShell } from '@/components/layout/AppShell';
import { CodeDetail } from '@/features/codes/components/CodeDetail';

export const metadata = { title: 'Code · qr-infra' };

/** Next 16 makes route params async. */
export default async function CodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <CodeDetail codeId={id} />
    </AppShell>
  );
}
