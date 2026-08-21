import type { ReactNode } from 'react';

import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import {
  AttemptReportMini,
  DrillMini,
  LessonListMini,
  TimedExamMini,
  WeeklyBarsMini,
} from '../mockups/minis';
import { PlateCard, SectionIntro, SectionShell } from '../parts';

/**
 * §features — the bento.
 *
 * Five cards in two rows, and the asymmetry is the argument: the top three are
 * narrow and each shows a fragment of the interface, the bottom two are wide
 * and each shows a whole panel. The two wide ones are the claims that need the
 * most evidence — that a drill follows every lesson, and that a report follows
 * every attempt — so they get the room to prove it.
 *
 * The card that used to sit fifth here promised «وصول دائم». The canvas
 * replaced it with the attempt report; the permanent-access promise did not
 * leave the site, it is the third FAQ and it is on every catalogue page, where
 * a buyer is actually deciding.
 *
 * Every drawing inside these cards is specimen artwork, `aria-hidden` from
 * inside the mini itself.
 */
const FEATURES = COPY.landing.features;

function FeatureCard({
  title,
  body,
  step,
  className,
  children,
}: {
  title: string;
  body: string;
  step: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    /*
     * `min-w-0` is load-bearing, not defensive. A grid item's default
     * `min-width: auto` lets it grow to its content's min-content width, and the
     * drawings inside the two wide cards contain `whitespace-nowrap` rows that
     * are wider than a phone. Without this the cards pushed the document 42px
     * sideways at 390px.
     */
    <PlateCard className={cn('reveal flex min-w-0 flex-col', className)}>
      <h3 className="text-ink-900 text-h3">{title}</h3>
      <p className="text-ink-600 mt-2.5 text-[15px] leading-[1.8] font-light">{body}</p>
      <div className="mt-5.5 flex min-w-0 flex-1 flex-col">{children}</div>
    </PlateCard>
  );
}

export function Features() {
  return (
    <SectionShell id="features" className="pb-12 sm:pb-16 lg:pb-[90px]">
      <SectionIntro title={FEATURES.title} lead={FEATURES.lead} />

      <div className="mt-14 grid gap-5.5 text-start sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title={FEATURES.cards.courses.title}
          body={FEATURES.cards.courses.body}
          step={2}
        >
          <LessonListMini />
        </FeatureCard>

        <FeatureCard
          title={FEATURES.cards.simulation.title}
          body={FEATURES.cards.simulation.body}
          step={3}
        >
          <TimedExamMini />
        </FeatureCard>

        {/*
          On a two-column phone-to-tablet grid this third card would be left
          alone on its own row with a hole beside it; spanning it closes the
          hole, and at `lg` the span is irrelevant because the row holds three.
        */}
        <FeatureCard
          title={FEATURES.cards.progress.title}
          body={FEATURES.cards.progress.body}
          step={4}
          className="sm:col-span-2 lg:col-span-1"
        >
          <WeeklyBarsMini />
        </FeatureCard>
      </div>

      <div className="mt-5.5 grid gap-5.5 text-start lg:grid-cols-2">
        <FeatureCard
          title={FEATURES.cards.quizzes.title}
          body={FEATURES.cards.quizzes.body}
          step={2}
          className="p-7 sm:p-8"
        >
          <DrillMini />
        </FeatureCard>

        <FeatureCard
          title={FEATURES.cards.report.title}
          body={FEATURES.cards.report.body}
          step={3}
          className="p-7 sm:p-8"
        >
          <AttemptReportMini />
        </FeatureCard>
      </div>
    </SectionShell>
  );
}
