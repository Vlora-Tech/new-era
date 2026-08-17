import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/auth-forms';
import { BrandLogoBlock } from '@/components/layout/brand';
import { Card, Container, Skeleton } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.auth.registerTitle };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <Container className="py-12 lg:py-20">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        {/* Same placement rule as /login — see the note there. */}
        <BrandLogoBlock width={220} priority />

        <Card className="mt-10 w-full p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span aria-hidden="true" className="bg-brand-700 block h-px w-10" />
            <h1 className="text-ink-900 mt-6 text-[26px] leading-[1.35] font-semibold">
              {COPY.auth.registerTitle}
            </h1>
            <p className="text-ink-700 mt-3 text-[15px] leading-[1.8]">
              {COPY.auth.registerSubtitle}
            </p>
          </div>

          <div className="border-line-200 mt-8 border-t pt-8">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <RegisterForm />
            </Suspense>
          </div>
        </Card>
      </div>
    </Container>
  );
}
