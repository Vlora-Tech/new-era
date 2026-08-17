import Link from 'next/link';
import { ArrowLeft, BookOpen, ClipboardList } from 'lucide-react';

import { KhatimField, SheetTicks } from '@/components/marketing/ornament';
import { arabicIndex, SectionHead } from '@/components/marketing/section-head';
import { StudyArtifact } from '@/components/marketing/study-artifact';
import { Button } from '@/components/ui/button';
import { Badge, Container, EmptyState, ErrorState } from '@/components/ui/surface';
import { BRAND, COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatHalalas } from '@/lib/format';

/**
 * The homepage.
 *
 * One document in six numbered chapters, opened by a masthead and closed by a
 * colophon, with a course of khatim tilework as the rule at each end.
 *
 * The composition is architectural rather than decorative, which is the whole
 * argument: rank is carried by rule, weight, position and white space, and by
 * nothing else. There is no shadow on this page, no gradient, no blur, no
 * floating panel, no dark band, no wall of rounded cards, and no motion beyond a
 * 150ms colour change on the things you can click. What makes it look expensive
 * is the alignment and the air, not an effect.
 *
 * THE LOGO. The supplied lockup is stacked and needs 220px of width before both
 * of its wordmarks read, so it is given a masthead of its own at the very top of
 * the page at 240px, on white, with the clear space the guidelines require and
 * its artwork edge — not its padding box — sitting on the container's grid. It
 * appears at full size again in the footer and on the sign-in and registration
 * pages. The 64px header bar carries set type instead, because scaling this file
 * down to fit a bar is exactly the improvised compact lockup the guidelines
 * forbid.
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

/** The bullet characters become a ruled series; the stored string is unchanged. */
const LEARNING_PARTS = COPY.home.learningLine.split(' • ');

export default async function HomePage() {
  const featured = await loadFeaturedProducts();

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      {/*
       * The warm canvas, not white: the specimen is a white sheet, and a white
       * sheet on a white ground is the reason this fold read as flat.
       */}
      <section className="bg-canvas">
        <Container>
          <div className="grid gap-y-14 pt-12 pb-16 lg:grid-cols-12 lg:gap-x-8 lg:pt-20 lg:pb-24">
            {/*
             * Copy first in the document, and therefore first on a phone: the
             * argument is what a visitor came for and the specimen page is what
             * supports it. Columns 1–6 are the reading side under dir="rtl";
             * column 7 is left deliberately empty as the spread's gutter.
             */}
            <div className="lg:col-span-6 lg:col-start-1">
              <p className="text-brand-700 flex items-center gap-2.5 text-[13px] font-semibold">
                <span aria-hidden="true" className="bg-brand-700 block h-px w-7" />
                {COPY.home.eyebrow}
              </p>

              <h1 className="text-display text-ink-900 mt-5">{COPY.home.heading}</h1>

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

              {/* The four movements of the method, as a ruled series. */}
              <ul className="border-line-200 mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5">
                {LEARNING_PARTS.map((part, index) => (
                  <li
                    key={part}
                    className={
                      index === 0
                        ? 'text-ink-700 text-[14px] font-medium'
                        : 'border-line-200 text-ink-700 border-s ps-5 text-[14px] font-medium'
                    }
                  >
                    {part}
                  </li>
                ))}
              </ul>

              <p className="text-ink-600 measure-ar mt-6 text-[13px] leading-[1.85]">
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
                <p className="text-ink-600 text-[12px]">{COPY.legal.sampleContentLabel}</p>
              </div>

              {/*
               * A tinted ground behind the specimen, offset so the white card
               * reads as a sheet resting on a surface rather than floating.
               * Flat colour and one course of tilework — no gradient, no blur,
               * no shadow: depth here comes from overlap, which is honest.
               */}
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="bg-brand-100 rounded-panel absolute -inset-x-6 top-8 -bottom-8 overflow-hidden"
                >
                  <div className="text-brand-500 absolute inset-0">
                    <KhatimField id="neb-khatim-hero" tile={72} opacity={0.26} />
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

      {/* ── ٠١ The method: four columns standing on one ruler ──────────────── */}
      <section className="bg-surface">
        <Container className="py-16 lg:py-24">
          <SectionHead index={1} title={COPY.home.pathTitle} />

          <ol className="mt-12 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {COPY.home.pathSteps.map((step, index) => (
              <li key={step.title} className="border-line-200 border-t pt-5">
                <span
                  aria-hidden="true"
                  className="text-brand-700 text-[12px] font-semibold tabular-nums"
                >
                  {arabicIndex(index + 1)}
                </span>
                <h3 className="text-ink-900 mt-3 text-[19px] leading-[1.5] font-semibold">
                  {step.title}
                </h3>
                <p className="text-ink-700 mt-2 text-[15px] leading-[1.8]">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ── ٠٢ Two catalogues: two facing pages divided by one rule ────────── */}
      <section className="bg-surface">
        <Container className="pb-16 lg:pb-24">
          <SectionHead index={2} title={COPY.home.productsTitle} />

          {/*
           * `flex flex-col` on each page and `mt-auto` on its action is what puts
           * the two buttons on one line even though the two descriptions do not
           * wrap to the same number of lines. Two actions of equal rank resting
           * at different heights is what makes a spread look assembled rather
           * than composed.
           */}
          <div className="mt-12 grid lg:grid-cols-2">
            <div className="border-line-200 flex flex-col border-t pt-7 lg:border-e lg:border-t-0 lg:pe-14 lg:pt-0">
              <BookOpen className="text-brand-700 size-6" strokeWidth={1.75} aria-hidden="true" />
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

            <div className="border-line-200 mt-10 flex flex-col border-t pt-7 lg:mt-0 lg:border-t-0 lg:ps-14 lg:pt-0">
              <ClipboardList
                className="text-brand-700 size-6"
                strokeWidth={1.75}
                aria-hidden="true"
              />
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
          <SectionHead index={3} title={COPY.home.featuredTitle} />

          <div className="mt-12">
            {!featured.ok ? (
              <ErrorState />
            ) : featured.products.length === 0 ? (
              <EmptyState title={COPY.home.featuredEmpty} />
            ) : (
              <ul className="border-line-200 divide-line-200 divide-y border-y">
                {featured.products.map((product, index) => (
                  <li
                    key={product.id}
                    // `relative` anchors the title link's full-row hit area. The
                    // white ground lifts the row off the warm canvas and the
                    // title colour changes with it, so hover is never carried by
                    // a background alone.
                    className="group hover:bg-surface relative grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3 py-7 transition-colors duration-150 ease-out lg:grid-cols-[3rem_minmax(0,1fr)_8rem_12rem] lg:gap-x-6 lg:gap-y-0"
                  >
                    <span
                      aria-hidden="true"
                      className="text-ink-600 text-[13px] font-medium tabular-nums"
                    >
                      {arabicIndex(index + 1)}
                    </span>

                    <Badge
                      variant="outline"
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
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {/* ── ٠٤ Buying and starting: three marks on a dimension line ────────── */}
      <section id="how-it-works" className="bg-surface scroll-mt-16">
        <Container className="py-16 lg:py-24">
          <SectionHead index={4} title={COPY.home.howTitle} />

          <ol className="mt-12 grid gap-x-8 gap-y-9 lg:grid-cols-3">
            {COPY.home.howSteps.map((step, index) => (
              <li key={step.title} className="border-line-200 relative border-t pt-6">
                {/* A 10px square standing on the rule, as a dimension mark. */}
                <span
                  aria-hidden="true"
                  className="bg-brand-700 absolute start-0 -top-[5px] block size-2.5"
                />
                <span
                  aria-hidden="true"
                  className="text-ink-600 text-[12px] font-medium tabular-nums"
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
            ))}
          </ol>
        </Container>
      </section>

      {/* ── ٠٥ Why the method works: an editorial spread ────────────────────── */}
      <section className="bg-surface">
        <Container className="pb-16 lg:pb-24">
          <SectionHead index={5} title={COPY.home.whyTitle} description={COPY.home.safeExamClaim} />

          <ul className="border-line-200 mt-12 border-b">
            {COPY.home.whyReasons.map((reason) => (
              <li
                key={reason.title}
                className="border-line-200 grid gap-x-12 gap-y-3 border-t py-7 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]"
              >
                <h3 className="text-ink-900 text-[19px] leading-[1.5] font-semibold">
                  {reason.title}
                </h3>
                <p className="text-ink-700 text-[15px] leading-[1.9]">{reason.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── ٠٦ Questions: always open, fully crawlable, still a Server Component ── */}
      <section className="bg-canvas">
        <Container className="py-16 lg:py-24">
          <SectionHead index={6} title={COPY.home.faqTitle} />

          <dl className="mt-12 grid gap-x-14 lg:grid-cols-2">
            {COPY.home.faq.map((item) => (
              <div key={item.question} className="border-line-200 border-t py-6">
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
      <section className="bg-surface">
        <Container className="py-16 lg:py-20">
          <div className="grid gap-y-9 lg:grid-cols-12 lg:items-end lg:gap-x-8">
            <div className="lg:col-span-6 lg:col-start-1">
              <p className="text-ink-600 text-[13px] font-medium">{BRAND.name}</p>
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
          <p className="border-line-200 text-ink-600 measure-ar-lg mt-14 border-t pt-6 text-[13px] leading-[1.95]">
            {INDEPENDENCE_DISCLAIMER}
          </p>
        </Container>
      </section>
    </>
  );
}
