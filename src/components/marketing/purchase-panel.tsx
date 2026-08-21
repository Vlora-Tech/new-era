import Link from 'next/link';
import { BadgeCheck, CheckCircle2, Clock3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { COPY } from '@/lib/copy';
import { ROUTES } from '@/lib/constants';
import { fillTemplate } from '@/lib/exam/template';
import { formatDate, formatHalalas, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CourseDetail, PurchaseState } from '@/services/catalog/product-detail';

/**
 * The product page's decision panel.
 *
 * One component for both detail pages, because the decision it encodes is the
 * same on both and had drifted into being made twice: each page rendered a price
 * card unconditionally and swapped only its button when the viewer owned the
 * product. The panel therefore went on saying «شراء لمرة واحدة» to somebody who
 * had already bought, next to a figure they had already paid — which is not a
 * cosmetic slip. It is the page inviting a second purchase.
 *
 * So the panel is chosen by state rather than dressed by it:
 *
 *  - **owned** — no price, no purchase language at all. A way in, and for a
 *    course the progress that says where the way in leads.
 *  - **pending-order** — the student's own unpaid order, not a control that
 *    would open a second one. This is the state that actually protects money.
 *  - **available** — the buy panel, and the only state that shows a price.
 *
 * `PurchaseState` is decided on the server from the entitlement and order rows
 * (`services/catalog/product-detail.ts`); nothing here infers it from the
 * browser.
 *
 * ── Two grounds ────────────────────────────────────────────────────────────
 *
 * `surface` chooses the skin, and ONLY the skin: which of the three panels
 * renders, what it says and where its control leads are decided above and are
 * identical on both. The course page mounts the panel inside its cover plate
 * (`cover`), where a white card would punch a hole in the image; the simulator
 * page keeps it as a card in the rail (`card`). Two skins rather than two
 * components, because a second component is exactly how this panel came to say
 * the wrong thing to a paying student the first time.
 *
 * Every value in the `cover` skin is stated against its worst case — the glass
 * over a bright photograph under the plate's own scrim, which composites to
 * about #2d3744. White is 12:1 there, `white/70` is 6.6:1 and `cover-mint` is
 * 7.9:1, so all three clear the body-text floor. The approved canvas set its
 * small labels at 0.6 alpha; they are raised here, because 3.9:1 is not a
 * legible 12px line whatever it looks like on an artboard.
 */

const PANEL = COPY.catalog.panel;

/** Which ground the panel is being drawn on. */
export type PanelSurface = 'card' | 'cover';

const SKIN = {
  card: {
    /* The one hero-weight shadow on the page: the panel being acted on. */
    shell: 'rounded-panel border-line-200 bg-surface shadow-card-lg border p-6',
    title: 'text-ink-900',
    body: 'text-ink-700',
    meta: 'text-ink-600',
    rule: 'border-line-200',
    divide: 'divide-line-200',
    track: 'bg-surface-muted',
    fill: 'bg-brand-600',
    ownedGlyph: 'text-success',
    pendingGlyph: 'text-warning',
    button: 'primary',
    shape: 'control',
  },
  cover: {
    shell: 'rounded-shell border border-white/20 bg-white/10 p-6 backdrop-blur-[18px]',
    title: 'text-white',
    body: 'text-white/80',
    meta: 'text-white/70',
    rule: 'border-white/20',
    divide: 'divide-white/20',
    track: 'bg-white/15',
    fill: 'bg-gradient-meter',
    ownedGlyph: 'text-cover-mint',
    /* No warning ochre on the plate: at 12px over navy it is unreadable, and
       the sentence beside the glyph is what carries the state anyway. */
    pendingGlyph: 'text-white',
    button: 'cover',
    shape: 'pill',
  },
} as const;

type PurchasePanelProps = {
  purchase: PurchaseState;
  priceHalalas: number;
  slug: string;
  surface?: PanelSurface;
} & (
  | { kind: 'course'; ownerProgress: CourseDetail['ownerProgress'] }
  | { kind: 'simulator'; ownerProgress?: never }
);

export function PurchasePanel(props: PurchasePanelProps) {
  const { purchase, priceHalalas, slug, kind, surface = 'card' } = props;

  if (purchase.kind === 'owned') {
    return (
      <OwnedPanel
        kind={kind}
        slug={slug}
        surface={surface}
        grantedAt={purchase.grantedAt}
        ownerProgress={kind === 'course' ? (props.ownerProgress ?? null) : null}
      />
    );
  }

  if (purchase.kind === 'pending-order') {
    return (
      <PendingPanel orderId={purchase.orderId} createdAt={purchase.createdAt} surface={surface} />
    );
  }

  return <BuyPanel kind={kind} slug={slug} surface={surface} priceHalalas={priceHalalas} />;
}

/** The panel's primary control, in whichever shape the ground calls for. */
function PanelAction({
  surface,
  href,
  children,
}: {
  surface: PanelSurface;
  href: string;
  children: React.ReactNode;
}) {
  const skin = SKIN[surface];

  return (
    <Button asChild variant={skin.button} shape={skin.shape} size="lg" className="mt-6 w-full">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

// ─────────────────────────────── Owned ───────────────────────────────

function OwnedPanel({
  kind,
  slug,
  surface,
  grantedAt,
  ownerProgress,
}: {
  kind: 'course' | 'simulator';
  slug: string;
  surface: PanelSurface;
  grantedAt: Date | null;
  ownerProgress: CourseDetail['ownerProgress'];
}) {
  const skin = SKIN[surface];

  /*
   * A course opens at the lesson the student stopped on, not at a dashboard
   * list that would make them find the course again. The dashboard's own
   * "open" link already lands here, so a panel that pointed back at it would
   * close a loop rather than let anyone in.
   */
  const target =
    kind === 'course'
      ? ownerProgress?.resumeLessonId
        ? `/learn/${slug}/${ownerProgress.resumeLessonId}`
        : null
      : ROUTES.dashboardSimulators;

  const label =
    kind === 'simulator'
      ? PANEL.startSimulator
      : !ownerProgress?.hasUnfinished
        ? PANEL.reviewCourse
        : (ownerProgress?.completedCount ?? 0) > 0
          ? PANEL.continueCourse
          : PANEL.startCourse;

  const percent =
    ownerProgress && ownerProgress.totalCount > 0
      ? Math.round((ownerProgress.completedCount / ownerProgress.totalCount) * 100)
      : null;

  return (
    <div className={skin.shell}>
      <p className={cn('flex items-center gap-2 font-semibold', skin.title)}>
        {/* Colour is never the only signal: the icon sits beside a sentence
            that says the same thing. */}
        <BadgeCheck className={cn('size-5 shrink-0', skin.ownedGlyph)} aria-hidden="true" />
        {kind === 'course' ? PANEL.ownedCourseTitle : PANEL.ownedSimulatorTitle}
      </p>

      <p className={cn('mt-3 text-sm leading-[1.8]', skin.body)}>{PANEL.ownedBody}</p>

      {percent !== null && ownerProgress ? (
        <div className="mt-5">
          <div className={cn('flex items-baseline justify-between gap-3 text-sm', skin.body)}>
            <span>{PANEL.progressLabel}</span>
            {/* The bar is `aria-hidden` by contract, so the figure is stated. */}
            <span className={cn('font-medium tabular-nums', skin.title)}>
              {fillTemplate(PANEL.progressCount, {
                completed: formatNumber(ownerProgress.completedCount),
                total: formatNumber(ownerProgress.totalCount),
              })}
            </span>
          </div>
          <ProgressBar value={percent} tone={skin.fill} track={skin.track} className="mt-2" />
        </div>
      ) : null}

      {target ? (
        <PanelAction surface={surface} href={target}>
          {label}
        </PanelAction>
      ) : (
        <p className={cn('mt-6 border-t pt-5 text-sm leading-[1.85]', skin.body, skin.rule)}>
          {PANEL.ownedButEmpty}
        </p>
      )}

      {grantedAt ? (
        <p className={cn('mt-6 border-t pt-5 text-sm', skin.meta, skin.rule)}>
          {fillTemplate(PANEL.accessSince, { date: formatDate(grantedAt) })}
        </p>
      ) : null}
    </div>
  );
}

// ───────────────────────────── Mid-payment ─────────────────────────────

function PendingPanel({
  orderId,
  createdAt,
  surface,
}: {
  orderId: string;
  createdAt: Date;
  surface: PanelSurface;
}) {
  const skin = SKIN[surface];

  return (
    <div className={skin.shell}>
      <p className={cn('flex items-center gap-2 font-semibold', skin.title)}>
        <Clock3 className={cn('size-5 shrink-0', skin.pendingGlyph)} aria-hidden="true" />
        {PANEL.pendingTitle}
      </p>

      <p className={cn('mt-3 text-sm leading-[1.8]', skin.body)}>{PANEL.pendingBody}</p>

      <dl
        className={cn(
          'mt-5 flex items-baseline justify-between gap-3 border-t pt-4 text-sm',
          skin.rule,
        )}
      >
        <dt className={skin.body}>{PANEL.pendingOrderDate}</dt>
        <dd className={cn('font-medium', skin.title)}>{formatDate(createdAt)}</dd>
      </dl>

      <PanelAction surface={surface} href={`/checkout/${orderId}`}>
        {PANEL.pendingAction}
      </PanelAction>

      {/* The existing warning, reused rather than reworded: "wait and retry" is
          otherwise read as "pay again". */}
      <p className={cn('mt-6 border-t pt-5 text-sm leading-[1.85]', skin.body, skin.rule)}>
        {COPY.commerce.doNotPayTwice}
      </p>
    </div>
  );
}

// ─────────────────────────────── Buying ───────────────────────────────

function BuyPanel({
  kind,
  slug,
  surface,
  priceHalalas,
}: {
  kind: 'course' | 'simulator';
  slug: string;
  surface: PanelSurface;
  priceHalalas: number;
}) {
  const skin = SKIN[surface];

  return (
    <div className={skin.shell}>
      {/* The price is a stat numeral: display face, 700, tabular. */}
      <p className={cn('font-display text-[30px] leading-none font-bold tabular-nums', skin.title)}>
        {formatHalalas(priceHalalas)}
      </p>
      <p className={cn('mt-3 text-sm leading-[1.8]', skin.body)}>{PANEL.oneTimePurchase}</p>

      <PanelAction surface={surface} href={`/checkout/start?product=${slug}`}>
        {kind === 'course' ? PANEL.buyCourse : PANEL.buySimulator}
      </PanelAction>

      {kind === 'course' ? (
        <ul className={cn('mt-6 divide-y border-t text-sm', skin.body, skin.rule, skin.divide)}>
          {PANEL.courseIncludes.map((line) => (
            <li key={line} className="flex items-start gap-2.5 py-2.5">
              <CheckCircle2
                className={cn('mt-0.5 size-4 shrink-0', skin.ownedGlyph)}
                aria-hidden="true"
              />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn('mt-6 border-t pt-5 text-sm leading-[1.85]', skin.body, skin.rule)}>
          {PANEL.simulatorNote}
        </p>
      )}
    </div>
  );
}
