import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

import {
  IconDevices,
  IconForward,
  IconHistory,
  IconPermanent,
  IconProducts,
  IconUnlocked,
} from '../icons';
import { CheckList, GlyphTile, revealDelay, SectionIntro, SectionShell } from '../parts';

/**
 * The two products, and the one-purchase promise.
 *
 * No prices are shown. That is deliberate and not an oversight: prices live on
 * the catalogue pages, where they come from the database, and a figure typed
 * into a marketing card is the kind that goes stale silently. The two cards
 * link straight there.
 *
 * The section says «شراء مرة واحدة» three times over — badge, note, and its own
 * card — because it is the product's single most misunderstood property. There
 * is no subscription anywhere in the platform, and no countdown, discount or
 * scarcity device on this page to imply one is expiring.
 */
const PRODUCTS = COPY.landing.products;

const ONCE_ICONS = [IconUnlocked, IconHistory, IconDevices] as const;

function ProductCard({
  title,
  badge,
  body,
  note,
  cta,
  href,
  includes,
  delay,
}: {
  title: string;
  badge?: string;
  body: string;
  note: string;
  cta: string;
  href: string;
  includes: readonly string[];
  delay: number;
}) {
  return (
    <article
      className="rounded-plate border-line-200 bg-surface shadow-card reveal flex flex-col border p-7 text-start"
      style={revealDelay(delay)}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="font-display text-ink-900 text-[21px] font-semibold">{title}</h3>
        {badge ? (
          <span className="bg-accent-teal-soft text-accent-teal rounded-full px-2.5 py-1 text-[12px] font-semibold">
            {badge}
          </span>
        ) : null}
      </div>

      {/*
       * One product's description runs to two lines and the other's to one. The
       * floor keeps the badge, the note and — most visibly — the two call-to-
       * action buttons on the same line across the row, which is what makes the
       * pair read as a choice rather than as two unrelated cards.
       */}
      <p className="text-ink-700 mt-3 text-[15px] leading-relaxed lg:min-h-[3.5rem]">{body}</p>

      <span className="bg-brand-100 text-brand-700 mt-6 inline-flex w-fit items-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
        {PRODUCTS.purchaseBadge}
      </span>
      <p className="text-ink-600 mt-2 text-[13px]">{note}</p>

      <Button asChild variant="gradient" shape="pill" size="lg" className="mt-6 w-full">
        <Link href={href}>
          {cta}
          <IconForward className="size-4" aria-hidden="true" />
        </Link>
      </Button>

      <div className="border-line-200 mt-7 border-t pt-6">
        <p className="text-ink-900 text-[13px] font-bold">{PRODUCTS.includesTitle}</p>
        <CheckList items={includes} className="mt-4" />
      </div>
    </article>
  );
}

export function Products() {
  return (
    <SectionShell id="products">
      <SectionIntro
        icon={IconProducts}
        eyebrow={PRODUCTS.eyebrow}
        title={PRODUCTS.title}
        lead={PRODUCTS.lead}
      />

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        <ProductCard
          title={PRODUCTS.courses.title}
          body={PRODUCTS.courses.body}
          note={PRODUCTS.courses.note}
          cta={PRODUCTS.courses.cta}
          href="/courses"
          includes={PRODUCTS.courses.includes}
          delay={0}
        />
        <ProductCard
          title={PRODUCTS.simulators.title}
          badge={PRODUCTS.simulators.badge}
          body={PRODUCTS.simulators.body}
          note={PRODUCTS.simulators.note}
          cta={PRODUCTS.simulators.cta}
          href="/simulators"
          includes={PRODUCTS.simulators.includes}
          delay={90}
        />

        <article
          className="rounded-plate border-line-200 reveal from-brand-50 flex flex-col border bg-linear-to-b to-white p-7 text-start"
          style={revealDelay(180)}
        >
          <GlyphTile icon={IconPermanent} size="xl" />
          <h3 className="font-display text-ink-900 mt-6 text-[21px] font-semibold">
            {PRODUCTS.once.title}
          </h3>
          <p className="text-ink-700 mt-3 text-[15px] leading-relaxed">{PRODUCTS.once.body}</p>

          <ul className="mt-7 flex flex-col gap-4">
            {PRODUCTS.once.rows.map((row, index) => {
              const Icon = ONCE_ICONS[index];
              return (
                <li key={row} className="text-ink-700 flex items-center gap-3 text-[14.5px]">
                  <span className="bg-surface border-line-200 text-brand-700 flex size-9 shrink-0 items-center justify-center rounded-[11px] border shadow-xs">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  {row}
                </li>
              );
            })}
          </ul>
        </article>
      </div>
    </SectionShell>
  );
}
