import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/auth-forms';
import { BrandLogoBlock } from '@/components/layout/brand';
import { Card, Skeleton } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.auth.registerTitle };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-16">
      <BrandLogoBlock width={220} />

      <Card className="w-full p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-1.5 text-center">
          <h1 className="text-ink-900 text-2xl font-semibold">{COPY.auth.registerTitle}</h1>
          <p className="text-ink-700 text-sm">{COPY.auth.registerSubtitle}</p>
        </div>

        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <RegisterForm />
        </Suspense>
      </Card>
    </div>
  );
}
