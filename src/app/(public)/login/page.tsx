import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/auth-forms';
import { BrandLogoBlock } from '@/components/layout/brand';
import { Card, Container, Skeleton } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.auth.loginTitle };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Someone already signed in has no use for this page.
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <Container className="py-12 lg:py-20">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        {/*
         * One of the few placements with room for the full supplied lockup: the
         * stacked artwork at the 220px legibility floor, on white, with the 12%
         * clear space the guidelines require. It sits outside the card on
         * purpose — 220 + 2 × 28 is 276px, which needs the whole gutter-to-gutter
         * width at 320px and cannot survive a card's own padding as well.
         */}
        <BrandLogoBlock width={220} priority />

        <Card className="mt-10 w-full p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            {/* The hero's lead rule, at auth scale. */}
            <span aria-hidden="true" className="bg-brand-700 block h-px w-10" />
            <h1 className="text-ink-900 mt-6 text-[26px] leading-[1.35] font-semibold">
              {COPY.auth.loginTitle}
            </h1>
            <p className="text-ink-700 mt-3 text-[15px] leading-[1.8]">{COPY.auth.loginSubtitle}</p>
          </div>

          <div className="border-line-200 mt-8 border-t pt-8">
            {/* The form reads `next` from the query string, so it must be suspended. */}
            <Suspense fallback={<Skeleton className="h-72 w-full" />}>
              <LoginForm />
            </Suspense>
          </div>
        </Card>
      </div>
    </Container>
  );
}
