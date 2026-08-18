import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

import {
  IconArabic,
  IconForward,
  IconMethod,
  IconResults,
  IconRights,
  IconSaved,
  IconWhy,
} from '../icons';
import { GlyphTile, Meter, revealDelay, SectionIntro, SectionShell } from '../parts';

/**
 * Why the platform.
 *
 * One tall card carrying the argument and the section's call to action, then
 * four short ones. The four are claims about how the product is built — original
 * content, Arabic-first, saved progress, training indicators — and each is
 * checkable against the product itself. None of them is a claim about results.
 */
const WHY = COPY.landing.why;
const MOCK = COPY.landing.mock;

const CARD_ICONS = [IconRights, IconArabic, IconSaved, IconResults] as const;

export function Why() {
  return (
    <SectionShell id="why">
      <SectionIntro icon={IconWhy} eyebrow={WHY.eyebrow} title={WHY.title} lead={WHY.lead} />

      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        {/* The argument */}
        <article className="rounded-plate border-line-200 bg-surface shadow-card reveal flex flex-col border p-7 text-start lg:p-9">
          <GlyphTile icon={IconMethod} size="lg" />
          <h3 className="font-display text-ink-900 mt-6 text-[22px] font-semibold">
            {WHY.feature.title}
          </h3>
          <p className="text-ink-700 measure-ar mt-3 text-[15.5px] leading-relaxed">
            {WHY.feature.body}
          </p>

          <div aria-hidden="true" className="mt-7 flex max-w-[320px] flex-col gap-3">
            <Meter label={MOCK.verbal} value={MOCK.verbalValue} percent={72} />
            <Meter label={MOCK.quantitative} value={MOCK.quantitativeValue} percent={64} />
          </div>

          <Button asChild variant="gradient" shape="pill" size="lg" className="mt-8 self-start">
            <Link href="/register">
              {WHY.feature.cta}
              <IconForward className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </article>

        {/* The four */}
        <div className="grid gap-5 sm:grid-cols-2">
          {WHY.cards.map((card, index) => (
            <article
              key={card.title}
              className="rounded-plate border-line-200 bg-surface shadow-card lift reveal border p-6 text-start"
              style={revealDelay(80 + index * 60)}
            >
              <GlyphTile icon={CARD_ICONS[index]} size="md" tone="soft" />
              <h3 className="font-display text-ink-900 mt-4 text-[16.5px] font-semibold">
                {card.title}
              </h3>
              <p className="text-ink-700 mt-2 text-[14px] leading-relaxed">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
