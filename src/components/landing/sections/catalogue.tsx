import type { ReactNode } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import { IconForward, IconTimer } from '../icons';
import { CoursePlayerMockup } from '../mockups/course-player';
import { ExamQuestionMockup } from '../mockups/exam';
import { CheckList, Eyebrow, SectionShell, SpecimenLabel } from '../parts';

/**
 * §courses and §simulators — the two halves of what is actually sold.
 *
 * The canvas folds them into one band of two big 28px shells rather than two
 * separate sections, and mirrors the second: copy on the left of the first,
 * copy on the right of the second. That alternation is the whole reason the
 * band does not read as two identical rows, so the `order` classes below are
 * load-bearing rather than cosmetic.
 *
 * `#sims` is an id on the inner shell, not on a section, because the canvas
 * links to it from the header rail. It carries its own `scroll-mt` for that
 * reason — a nested anchor does not inherit the section's.
 *
 * Both drawings are specimen artwork and both carry a visible caption.
 */
const COURSES = COPY.landing.courses;
const SIMULATORS = COPY.landing.simulators;

/** The 28px plate both halves sit on. */
function ShellCard({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        'border-line-200 rounded-shell reveal border p-6 shadow-xs sm:p-8 lg:p-11',
        id && 'scroll-mt-24 lg:scroll-mt-28',
        className,
      )}
    >
      <div className="grid items-center gap-7 lg:grid-cols-2 lg:gap-14">{children}</div>
    </div>
  );
}

/**
 * The soft glow behind each drawing. It is what stops a white mockup on a white
 * plate from reading as a floating rectangle with no ground.
 */
function DrawingGlow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute rounded-[50%] bg-[radial-gradient(closest-side,rgb(6_104_200/0.22),transparent)]',
        className,
      )}
    />
  );
}

export function Catalogue() {
  return (
    <SectionShell id="courses">
      <div className="flex flex-col gap-6.5">
        {/* ── Courses ───────────────────────────────────────────────────── */}
        <ShellCard className="from-brand-50/50 bg-linear-150 from-0% to-white to-40%">
          <div>
            <h2 className="text-ink-900 text-h2-tight">{COURSES.title}</h2>
            <p className="text-ink-700 mt-4 max-w-[420px] text-[16px] leading-[1.85] font-light">
              {COURSES.lead}
            </p>
            <CheckList items={COURSES.bullets} className="mt-6.5 max-w-[400px]" />
            <Button asChild variant="secondary" shape="pill" size="lg" className="mt-7">
              <Link href="/courses">
                {COURSES.cta}
                <IconForward className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="relative">
            <DrawingGlow className="inset-x-[-4%] top-[10%] bottom-[-8%]" />
            <div className="relative" aria-hidden="true">
              <CoursePlayerMockup />
            </div>
            <SpecimenLabel className="mt-4" />
          </div>
        </ShellCard>

        {/* ── Simulators ────────────────────────────────────────────────── */}
        <ShellCard id="sims" className="from-brand-50/70 bg-linear-150 from-0% to-white to-45%">
          <div className="lg:order-2">
            <Eyebrow icon={IconTimer}>{SIMULATORS.eyebrow}</Eyebrow>
            <h2 className="text-ink-900 text-h2-tight mt-5.5">{SIMULATORS.title}</h2>
            <p className="text-ink-700 mt-4 max-w-[420px] text-[16px] leading-[1.85] font-light">
              {SIMULATORS.lead}
            </p>

            <dl className="mt-6.5 grid max-w-[420px] gap-3 sm:grid-cols-2">
              {SIMULATORS.meta.map((item) => (
                <div
                  key={item.label}
                  className="border-line-200 bg-surface rounded-panel border px-4 py-3.5"
                >
                  <dt className="text-ink-600 text-[11.5px]">{item.label}</dt>
                  <dd className="font-display text-ink-900 mt-1 text-[17px] font-bold">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Button asChild variant="secondary" shape="pill" size="lg" className="mt-7">
              <Link href="/simulators">
                {SIMULATORS.cta}
                <IconForward className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="relative lg:order-1">
            <DrawingGlow className="inset-x-[-4%] top-[8%] bottom-[-10%]" />
            <div className="relative" aria-hidden="true">
              <ExamQuestionMockup />
            </div>
            <SpecimenLabel className="mt-4" />
          </div>
        </ShellCard>
      </div>
    </SectionShell>
  );
}
