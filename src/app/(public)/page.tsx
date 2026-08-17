import Link from 'next/link';
import { ArrowLeft, BookOpen, ClipboardList } from 'lucide-react';

import { ACCENT, accentAt } from '@/components/marketing/accent';
import { KhatimField, SheetTicks } from '@/components/marketing/ornament';
import { arabicIndex, SectionHead } from '@/components/marketing/section-head';
import { StudyArtifact } from '@/components/marketing/study-artifact';
import { Button } from '@/components/ui/button';
import { Badge, Container, EmptyState, ErrorState } from '@/components/ui/surface';
import { BRAND, COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatHalalas } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The homepage.
 *
 * One document in six numbered chapters, opened by a hero spread and closed by a
 * colophon, with a course of khatim tilework as the rule at each end.
 *
 * The composition is architectural rather than decorative, and rank is carried
 * by rule, weight, position, white space — and now by fill. There is still no
 * shadow on this page, no gradient, no blur, no floating panel and no motion
 * beyond a 150ms colour change on the things you can click. What changed is that
 * the page is no longer achromatic: it had two grounds a hundredth of a step
 * apart and one hue applied at tick size, which is why nine alternating bands
 * read as a single grey wall.
 *
 * THE COLOUR CODE is defined in `globals.css` and compiled to classes in
 * `marketing/accent.ts`. Four hues, one per movement of the method, stated as
 * four chips in the hero and then repeated by every chapter that has four of
 * anything. It is a code and not a palette: the hue is always redundant with a
 * numeral, a label or an icon, so nothing here is said by colour alone, and
 * every control stays brand blue no matter which chapter it sits in.
 *
 * THE LOGO is carried by the header bar, which is sized to the mark rather than
 * the other way round, and at full size by the footer and by the sign-in and
 * registration pages. It is deliberately not repeated in the hero: the bar is
 * directly above this section, and two copies of the same lockup 100px apart
 * reads as an accident rather than as a masthead. See docs/brand-assets-needed.md
 * and the note at the top of `layout/public-header.tsx`.
 */
export const dynamic = 'force-dynamic';

type FeaturedProduct = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  priceHalalas: number;
  type: 'COURSE' | 'EXAM_SIMULATOR';
};

async function loadFeaturedProducts(): Promise<
  { ok: true; products: FeaturedProduct[] } | { ok: false }
> {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      take: 4,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceHalalas: true,
        type: true,
      },
    });
    return { ok: true, products };
  } catch {
    // An outage must not render as "no products yet": that would read as a
    // true fact about the catalogue rather than a failure to load it.
    return { ok: false };
  }
}

/**
 * The bullet characters become the colour code's four chips. The stored string
 * is unchanged, and the order is load-bearing: these four movements are the same
 * four, in the same order, as `pathSteps` in chapter ٠١, so chip and panel carry
 * the same hue for the same idea.
 */
const LEARNING_PARTS = COPY.home.learningLine.split(' • ');

/** Courses read blue, simulators teal, wherever either appears on the page. */
const PRODUCT_ACCENT = { COURSE: ACCENT.blue, EXAM_SIMULATOR: ACCENT.teal } as const;

export default async function HomePage() {
  const featured = await loadFeaturedProducts();

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      {/*
       * The blue field, not the warm canvas. The specimen is a white sheet, and
       * the fold's job is to be the one place on the page that is unmistakably
       * branded before a word is read.
       */}
      <section className="bg-canvas-blue border-line-200 border-b">
        <Container>
          <div className="grid gap-y-14 pt-12 pb-16 lg:grid-cols-12 lg:gap-x-8 lg:pt-20 lg:pb-24">
            {/*
             * Copy first in the document, and therefore first on a phone: the
             * argument is what a visitor came for and the specimen page is what
             * supports it. Columns 1–6 are the reading side under dir="rtl";
             * column 7 is left deliberately empty as the spread's gutter.
             */}
            <div className="lg:col-span-6 lg:col-start-1">
              {/*
               * White on the blue field rather than a tinted chip: a soft ground
               * on a soft ground is 1.06:1 and would read as a printing fault.
               */}
              <p className="border-brand-700/25 text-brand-700 bg-surface inline-flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold">
                <span aria-hidden="true" className="bg-brand-700 block size-1.5 rounded-full" />
                {COPY.home.eyebrow}
              </p>

              <h1 className="text-display text-ink-900 mt-6">{COPY.home.heading}</h1>

              <p className="text-ink-700 measure-ar mt-7 text-[17px] leading-[1.9] lg:text-[18px]">
                {COPY.home.supporting}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="xl">
                  <Link href="/register">
                    {COPY.home.primaryAction}
                    {/* Forward points left in a right-to-left document. */}
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="xl" variant="secondary">
                  <Link href="/courses">{COPY.home.secondaryAction}</Link>
                </Button>
              </div>

              {/*
               * The colour code, stated once, in the order the method runs. Each
               * chip names its movement in words and carries its hue as a filled
               * square, so the code is legible before it is used and remains
               * legible to a reader who cannot separate the hues.
               */}
              <ul className="mt-10 flex flex-wrap gap-2">
                {LEARNING_PARTS.map((part, index) => {
                  const tone = ACCENT[accentAt(index)];
                  return (
                    <li
                      key={part}
                      className={cn(
                        'bg-surface flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-[13px] font-medium',
                        tone.hairline,
                        tone.ink,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn('block size-2 rounded-sm', tone.fill)}
                      />
                      {part}
                    </li>
                  );
                })}
              </ul>

              <p className="text-ink-700 measure-ar mt-6 text-[13px] leading-[1.85]">
                {COPY.home.safeExamClaim}
              </p>
            </div>

            {/* The specimen page, facing the argument across the empty column. */}
            <div className="lg:col-span-5 lg:col-start-8">
              {/*
               * Real text, outside the plate: the drawing discloses itself, so
               * it can never be read as a screenshot of an official interface.
               */}
              <div className="border-line-200 mb-4 flex items-center gap-3 border-t pt-3">
                <span aria-hidden="true" className="bg-brand-700 block h-0.5 w-6" />
                <p className="text-ink-700 text-[12px]">{COPY.legal.sampleContentLabel}</p>
              </div>

              {/*
               * A deeper tint behind the specimen, offset so the white card reads
               * as a sheet resting on a surface rather than floating. `brand-200`
               * rather than `brand-100`: on the blue field the paler tint was a
               * sixteenth of a step and vanished. Flat colour and one course of
               * tilework — no gradient, no blur, no shadow: depth here comes from
               * overlap, which is honest.
               */}
              <div className="relative">
                <div
                  aria-hidden="true"
                  // The outset is the page gutter at each breakpoint and never
                  // more: 24px past a 16px gutter put the ground 8px outside the
                  // viewport at 390 and opened a horizontal scrollbar on every
                  // phone. 16/24 land the ground exactly on the viewport edge
                  // below `lg`, and well inside the grid above it.
                  className="bg-brand-200 rounded-panel absolute -inset-x-4 top-8 -bottom-8 overflow-hidden sm:-inset-x-6"
                >
                  <div className="text-brand-700 absolute inset-0">
                    <KhatimField id="neb-khatim-hero" tile={72} opacity={0.2} />
                  </div>
                </div>

                <div className="relative">
                  <StudyArtifact />
                  <SheetTicks />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/*
       * The brand's signature line: one 80px course of khatim tilework, drawn as
       * construction rather than as mood, terminated by rules and never by a
       * fade. It opens the body of the document; the same course closes it.
       */}
      <div
        className="bg-surface border-line-200 text-brand-500 relative h-20 w-full overflow-hidden border-y"
        aria-hidden="true"
      >
        <KhatimField id="neb-khatim-open" tile={80} opacity={0.18} />
      </div>

      {/* ── ٠١ The method: the colour code, used ───────────────────────────── */}
      <section className="bg-surface">
        <Container className="py-16 lg:py-24">
          <SectionHead index={1} title={COPY.home.pathTitle} accent={accentAt(0)} />

          {/*
           * The four panels are the four chips in the hero, enlarged: same order,
           * same hues, same words. A tinted ground and a 3px cap rule give each
           * step a body instead of a hairline, which is what turns a row of four
           * text columns into a row of four objects.
           */}
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COPY.home.pathSteps.map((step, index) => {
              const tone = ACCENT[accentAt(index)];
              return (
                <li
                  key={step.title}
                  className={cn('rounded-panel border-t-[3px] p-5 lg:p-6', tone.soft, tone.rule)}
                >
                  <span
                    aria-hidden="true"
                    className={cn('text-[12px] font-semibold tabular-nums', tone.ink)}
                  >
                    {arabicIndex(index + 1)}
                  </span>
                  <h3 className="text-ink-900 mt-3 text-[19px] leading-[1.5] font-semibold">
                    {step.title}
                  </h3>
                  {/* `ink-700` is the smallest text permitted on a soft ground. */}
                  <p className="text-ink-700 mt-2 text-[15px] leading-[1.8]">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* ── ٠٢ Two catalogues, in the two hues they keep everywhere ────────── */}
      <section className="bg-surface">
        <Container className="pb-16 lg:pb-24">
          <SectionHead index={2} title={COPY.home.productsTitle} accent={accentAt(1)} />

          {/*
           * `flex flex-col` on each panel and `mt-auto` on its action is what puts
           * the two buttons on one line even though the two descriptions do not
           * wrap to the same number of lines. Two actions of equal rank resting
           * at different heights is what makes a spread look assembled rather
           * than composed.
           *
           * Both buttons stay brand blue on purpose. The panel's hue says which
           * catalogue this is; the button says what happens when you press it,
           * and that meaning must not change hue between two adjacent panels.
           */}
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <div className="rounded-panel bg-brand-100 border-brand-700 flex flex-col border-t-[3px] p-7 lg:p-9">
              <span
                aria-hidden="true"
                className="bg-brand-700 rounded-control flex size-12 items-center justify-center text-white"
              >
                <BookOpen className="size-6" strokeWidth={1.75} />
              </span>
              <h3 className="text-ink-900 mt-5 text-[22px] leading-[1.4] font-semibold lg:text-[24px]">
                {COPY.home.coursesTitle}
              </h3>
              <p className="text-ink-700 measure-ar mt-3 text-[16px] leading-[1.85]">
                {COPY.home.coursesBody}
              </p>
              <div className="mt-auto pt-7">
                <Button asChild variant="secondary" size="md">
                  <Link href="/courses">
                    {COPY.nav.courses}
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-panel bg-accent-teal-soft border-accent-teal flex flex-col border-t-[3px] p-7 lg:p-9">
              <span
                aria-hidden="true"
                className="bg-accent-teal rounded-control flex size-12 items-center justify-center text-white"
              >
                <ClipboardList className="size-6" strokeWidth={1.75} />
              </span>
              <h3 className="text-ink-900 mt-5 text-[22px] leading-[1.4] font-semibold lg:text-[24px]">
                {COPY.home.simulatorsTitle}
              </h3>
              <p className="text-ink-700 measure-ar mt-3 text-[16px] leading-[1.85]">
                {COPY.home.simulatorsBody}
              </p>
              <div className="mt-auto pt-7">
                <Button asChild variant="secondary" size="md">
                  <Link href="/simulators">
                    {COPY.nav.simulators}
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── ٠٣ The catalogue as a ledger, or an honest statement of absence ── */}
      <section className="bg-canvas">
        <Container className="py-16 lg:py-24">
          <SectionHead index={3} title={COPY.home.featuredTitle} accent={accentAt(2)} />

          <div className="mt-12">
            {!featured.ok ? (
              <ErrorState />
            ) : featured.products.length === 0 ? (
              <EmptyState title={COPY.home.featuredEmpty} />
            ) : (
              <ul className="border-line-200 divide-line-200 divide-y border-y">
                {featured.products.map((product, index) => {
                  const tone = PRODUCT_ACCENT[product.type];
                  return (
                    <li
                      key={product.id}
                      // `relative` anchors the title link's full-row hit area. The
                      // white ground lifts the row off the warm canvas and the
                      // title colour changes with it, so hover is never carried by
                      // a background alone.
                      className="group hover:bg-surface relative grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3 py-7 transition-colors duration-150 ease-out lg:grid-cols-[3rem_minmax(0,1fr)_8rem_12rem] lg:gap-x-6 lg:gap-y-0"
                    >
                      {/*
                       * The row's numeral sits in a tile in the product's own
                       * hue, so the ledger is colour-sorted by kind down its
                       * margin. A bare coloured numeral was tried first and was
                       * too small to register as anything at all against the warm
                       * canvas — at 13px a hue is a rumour, not a signal.
                       */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'rounded-control flex size-8 shrink-0 items-center justify-center self-start',
                          'text-[13px] font-semibold tabular-nums',
                          tone.soft,
                          tone.ink,
                        )}
                      >
                        {arabicIndex(index + 1)}
                      </span>

                      <Badge
                        variant={product.type === 'COURSE' ? 'brand' : 'teal'}
                        shape="square"
                        className="justify-self-start lg:col-start-3 lg:row-start-1"
                      >
                        {COPY.statusLabels.productType[product.type]}
                      </Badge>

                      <div className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                        <h3 className="text-[19px] leading-[1.45] font-semibold">
                          {/*
                           * `after:inset-0` makes the whole row the target instead
                           * of a 28px line of text. The trailing affordance below
                           * stays inert text: a second anchor for the same href
                           * would be a duplicated tab stop.
                           */}
                          <Link
                            href={`${product.type === 'COURSE' ? '/courses' : '/simulators'}/${product.slug}`}
                            className="text-ink-900 group-hover:text-brand-700 rounded-control transition-colors duration-150 ease-out after:absolute after:inset-0"
                          >
                            {product.title}
                          </Link>
                        </h3>
                        <p className="text-ink-700 mt-2 max-w-[46ch] text-[15px] leading-[1.75]">
                          {product.shortDescription}
                        </p>
                      </div>

                      <div className="col-span-2 flex items-center justify-between gap-4 lg:col-span-1 lg:col-start-4 lg:row-start-1">
                        <span className="text-ink-900 text-[17px] font-semibold tabular-nums">
                          {formatHalalas(product.priceHalalas)}
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-brand-700 inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"
                        >
                          {COPY.common.details}
                          <ArrowLeft className="size-4" />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {/* ── ٠٤ Buying and starting: three marks on a dimension line ────────── */}
      {/*
       * `scroll-mt` is the sticky header's own height — 80px, 96px from `lg`.
       * The header's nav links to this fragment, and without the offset the
       * section's rule and number land underneath the bar.
       */}
      <section id="how-it-works" className="bg-surface scroll-mt-20 lg:scroll-mt-24">
        <Container className="py-16 lg:py-24">
          <SectionHead index={4} title={COPY.home.howTitle} accent={accentAt(3)} />

          <ol className="mt-12 grid gap-x-8 gap-y-9 lg:grid-cols-3">
            {COPY.home.howSteps.map((step, index) => {
              const tone = ACCENT[accentAt(index)];
              return (
                <li key={step.title} className={cn('relative border-t-2 pt-6', tone.rule)}>
                  {/* A 10px square standing on the rule, as a dimension mark. */}
                  <span
                    aria-hidden="true"
                    className={cn('absolute start-0 -top-[5px] block size-2.5', tone.fill)}
                  />
                  <span
                    aria-hidden="true"
                    className={cn('text-[12px] font-medium tabular-nums', tone.ink)}
                  >
                    {arabicIndex(index + 1)}
                  </span>
                  <h3 className="text-ink-900 mt-2 text-[19px] leading-[1.5] font-semibold">
                    {step.title}
                  </h3>
                  <p className="text-ink-700 mt-2 max-w-[42ch] text-[15px] leading-[1.8]">
                    {step.body}
                  </p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* ── ٠٥ Why the method works: an editorial spread ────────────────────── */}
      <section className="bg-surface">
        <Container className="pb-16 lg:pb-24">
          <SectionHead
            index={5}
            title={COPY.home.whyTitle}
            description={COPY.home.safeExamClaim}
            accent={accentAt(4)}
          />

          <ul className="border-line-200 mt-12 border-b">
            {COPY.home.whyReasons.map((reason, index) => {
              const tone = ACCENT[accentAt(index)];
              return (
                <li
                  key={reason.title}
                  className="border-line-200 relative grid gap-x-12 gap-y-3 border-t py-7 ps-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]"
                >
                  {/*
                   * The reasons are the movements' rationale, so they carry the
                   * movements' hues in the same order — as a rule down the
                   * reading edge rather than as a bullet. A 10px square beside a
                   * 19px heading was the hue at tick size again, which is the
                   * exact failure this page was recoloured to fix; a full-height
                   * edge gives each reason a side without giving it a box, so
                   * this band stays an editorial spread and does not become a
                   * second row of the panels in chapter ٠١.
                   */}
                  <span
                    aria-hidden="true"
                    className={cn('absolute inset-y-7 start-0 block w-[3px]', tone.fill)}
                  />
                  <h3 className="text-ink-900 text-[19px] leading-[1.5] font-semibold">
                    {reason.title}
                  </h3>
                  <p className="text-ink-700 text-[15px] leading-[1.9]">{reason.body}</p>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ── ٠٦ Questions: always open, fully crawlable, still a Server Component ── */}
      <section className="bg-canvas">
        <Container className="py-16 lg:py-24">
          <SectionHead index={6} title={COPY.home.faqTitle} accent={accentAt(5)} />

          {/*
           * Cap rules rather than tinted panels: a soft ground on the warm canvas
           * is 1.03:1 and would read as a smudge. A 2px rule reads at any ground.
           */}
          <dl className="mt-12 grid gap-x-14 lg:grid-cols-2">
            {COPY.home.faq.map((item, index) => (
              <div
                key={item.question}
                className={cn('border-t-2 py-6', ACCENT[accentAt(index)].rule)}
              >
                <dt className="text-ink-900 text-[17px] leading-[1.5] font-semibold">
                  {item.question}
                </dt>
                <dd className="text-ink-700 mt-2 text-[15px] leading-[1.85]">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* The same course of tilework, closing the document it opened. */}
      <div
        className="bg-surface border-line-200 text-brand-500 relative h-20 w-full overflow-hidden border-y"
        aria-hidden="true"
      >
        <KhatimField id="neb-khatim-close" tile={80} opacity={0.18} />
      </div>

      {/* ── The colophon: the invitation, then the standing disclosure ─────── */}
      {/*
       * The blue field returns, so the document closes on the ground it opened
       * on. It is the light blue and not an inverted dark band: dark sections are
       * ruled out for this product, and a page that ends on its own opening
       * colour is a bookend rather than a different page stapled to the end.
       */}
      <section className="bg-canvas-blue">
        <Container className="py-16 lg:py-20">
          <div className="grid gap-y-9 lg:grid-cols-12 lg:items-end lg:gap-x-8">
            <div className="lg:col-span-6 lg:col-start-1">
              <p className="text-brand-700 flex items-center gap-2.5 text-[13px] font-semibold">
                <span aria-hidden="true" className="bg-brand-700 block h-px w-7" />
                {BRAND.name}
              </p>
              <h2 className="text-ink-900 mt-3 text-[30px] leading-[1.25] font-semibold lg:text-[40px]">
                {BRAND.tagline}
              </h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:col-start-8 lg:justify-end">
              <Button asChild size="xl">
                <Link href="/register">
                  {COPY.home.primaryAction}
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="secondary">
                <Link href="/courses">{COPY.home.secondaryAction}</Link>
              </Button>
            </div>
          </div>

          {/* Verbatim, visible at every breakpoint, and never trimmed for layout. */}
          <p className="border-brand-700/20 text-ink-700 measure-ar-lg mt-14 border-t pt-6 text-[13px] leading-[1.95]">
            {INDEPENDENCE_DISCLAIMER}
          </p>
        </Container>
      </section>
    </>
  );
}
