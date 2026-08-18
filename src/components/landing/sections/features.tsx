import type { ComponentType, ReactNode, SVGProps } from 'react';

import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import {
  IconCourses,
  IconFeatures,
  IconPermanent,
  IconQuiz,
  IconResults,
  IconTimer,
} from '../icons';
import {
  LessonListMini,
  PermanentAccessMini,
  QuickQuizMini,
  TimedExamMini,
  WeeklyBarsMini,
} from '../mockups/minis';
import { GlyphTile, revealDelay, SectionIntro, SectionShell } from '../parts';

/**
 * The feature bento.
 *
 * Five cards, each carrying its own fragment of the interface. The grid is
 * deliberately uneven — 2 / 3 on desktop rather than a tidy row of five —
 * because the claims are not of equal weight and a five-across row of identical
 * tiles reads as a spec sheet.
 *
 * Every mini inside is specimen artwork and is hidden from assistive tech: the
 * card's own title and body already say everything the drawing illustrates, so
 * announcing «08:24» and «4 / 12» after them would be noise, not information.
 */
const FEATURES = COPY.landing.features;

type Card = {
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
  art: ReactNode;
  className?: string;
};

const CARDS: readonly Card[] = [
  {
    key: 'courses',
    icon: IconCourses,
    title: FEATURES.cards.courses.title,
    body: FEATURES.cards.courses.body,
    art: <LessonListMini />,
    className: 'lg:col-span-3',
  },
  {
    key: 'simulation',
    icon: IconTimer,
    title: FEATURES.cards.simulation.title,
    body: FEATURES.cards.simulation.body,
    art: <TimedExamMini />,
    className: 'lg:col-span-3',
  },
  {
    key: 'progress',
    icon: IconResults,
    title: FEATURES.cards.progress.title,
    body: FEATURES.cards.progress.body,
    art: <WeeklyBarsMini />,
    className: 'lg:col-span-2',
  },
  {
    key: 'quizzes',
    icon: IconQuiz,
    title: FEATURES.cards.quizzes.title,
    body: FEATURES.cards.quizzes.body,
    art: <QuickQuizMini />,
    className: 'lg:col-span-2',
  },
  {
    key: 'access',
    icon: IconPermanent,
    title: FEATURES.cards.access.title,
    body: FEATURES.cards.access.body,
    art: <PermanentAccessMini />,
    className: 'lg:col-span-2',
  },
];

export function Features() {
  return (
    <SectionShell id="features">
      <SectionIntro
        icon={IconFeatures}
        eyebrow={FEATURES.eyebrow}
        title={FEATURES.title}
        lead={FEATURES.lead}
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
        {CARDS.map((card, index) => (
          <article
            key={card.key}
            className={cn(
              'rounded-plate border-line-200 bg-surface shadow-card reveal flex flex-col border p-6 text-start',
              card.className,
            )}
            style={revealDelay(index * 70)}
          >
            <GlyphTile icon={card.icon} size="lg" />
            <h3 className="font-display text-ink-900 mt-5 text-[19px] font-semibold">
              {card.title}
            </h3>
            <p className="text-ink-700 mt-2 text-[15px] leading-relaxed">{card.body}</p>
            <div aria-hidden="true" className="mt-5">
              {card.art}
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}
