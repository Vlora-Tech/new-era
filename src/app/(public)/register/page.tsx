import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/auth-forms';
import { BrandLogoBlock } from '@/components/layout/brand';
import { KhatimField } from '@/components/marketing/ornament';
import { Container, Skeleton } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { BRAND, COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.auth.registerTitle };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <Container className="py-12 lg:py-20">
      {/* Same composition and placement rules as /login — see the notes there. */}
      <div className="mx-auto flex w-full max-w-md flex-col items-center lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-stretch lg:gap-8">
        <BrandLogoBlock width={220} priority className="lg:hidden" />

        <div className="rounded-card border-line-200 bg-surface shadow-card-lg mt-10 w-full border p-6 sm:p-8 lg:mt-0">
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
        </div>

        <div className="rounded-card border-line-200 bg-canvas-blue hidden overflow-hidden border lg:flex lg:flex-col">
          <div className="flex flex-1 flex-col items-start justify-center p-10">
            <BrandLogoBlock width={220} priority />
            <p className="font-display text-ink-900 mt-8 text-[32px] leading-[1.4] font-bold">
              {BRAND.tagline}
            </p>
          </div>
          <div
            aria-hidden="true"
            className="text-brand-500 pointer-events-none relative h-20 w-full"
          >
            <KhatimField id="neb-khatim-register" tile={80} opacity={0.18} />
          </div>
        </div>
      </div>
    </Container>
  );
}
