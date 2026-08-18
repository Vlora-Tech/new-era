import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/auth-forms';
import { BrandLogoBlock } from '@/components/layout/brand';
import { KhatimField } from '@/components/marketing/ornament';
import { Container, Skeleton } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { BRAND, COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.auth.loginTitle };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Someone already signed in has no use for this page.
  const user = await getCurrentUser();
  if (user) redirect(user.role === 'ADMIN' ? '/admin' : '/dashboard');

  return (
    <Container className="py-12 lg:py-20">
      <div className="mx-auto flex w-full max-w-md flex-col items-center lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-stretch lg:gap-8">
        {/*
         * One of the few placements with room for the full supplied lockup: the
         * stacked artwork at the 220px legibility floor, on white, with the 12%
         * clear space the guidelines require. Below `lg` it sits outside the
         * card on purpose — 220 + 2 × 28 is 276px, which needs the whole
         * gutter-to-gutter width at 320px and cannot survive a card's own
         * padding as well. From `lg` the lockup moves into the brand panel,
         * which has that room; two responsive instances of the same asset cost
         * one preload, since next/image dedupes by URL.
         */}
        <BrandLogoBlock width={220} priority className="lg:hidden" />

        {/*
         * A hero plate, not a `Card`: the component's `rounded-panel` cannot be
         * overridden through `cn` — tailwind-merge does not know the custom
         * radius scale, and the stylesheet emits `.rounded-panel` after
         * `.rounded-card` — so the plate carries the full recipe itself.
         */}
        <div className="rounded-card border-line-200 bg-surface shadow-card-lg mt-10 w-full border p-6 sm:p-8 lg:mt-0">
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
        </div>

        {/*
         * The brand panel, `lg` and up only. The lockup keeps its own white
         * plate (`logo-clear-space`) on the tinted ground, so the guidelines'
         * no-tinted-surface rule is not violated. The khatim band sits below
         * the text — never behind it — and is terminated by the panel's own
         * edge on every side: `overflow-hidden` clips it to the drawn border.
         */}
        <div className="rounded-card border-line-200 bg-canvas-blue hidden overflow-hidden border lg:flex lg:flex-col">
          <div className="flex flex-1 flex-col items-start justify-center p-10">
            <BrandLogoBlock width={220} priority />
            <p className="font-display text-ink-900 mt-8 text-[32px] leading-[1.4] font-bold">
              {BRAND.tagline}
            </p>
          </div>
          {/* One full course of tile 80, the same figure as every other field. */}
          <div
            aria-hidden="true"
            className="text-brand-500 pointer-events-none relative h-20 w-full"
          >
            <KhatimField id="neb-khatim-login" tile={80} opacity={0.18} />
          </div>
        </div>
      </div>
    </Container>
  );
}
