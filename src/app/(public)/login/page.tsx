import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/auth-forms';
import { BrandLogoBlock } from '@/components/layout/brand';
import { Card, Skeleton } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.auth.loginTitle };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Someone already signed in has no use for this page.
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-16">
      {/* One of the few placements with room for the full supplied lockup. */}
      <BrandLogoBlock width={220} />

      <Card className="w-full p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-1.5 text-center">
          <h1 className="text-ink-900 text-2xl font-semibold">{COPY.auth.loginTitle}</h1>
          <p className="text-ink-700 text-sm">{COPY.auth.loginSubtitle}</p>
        </div>

        {/* The form reads `next` from the query string, so it must be suspended. */}
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
