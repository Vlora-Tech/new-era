import Link from 'next/link';

import { CourseCover, type CoverImage } from '@/components/marketing/course-cover';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatNumber } from '@/lib/format';
import { mediaAssetUrl } from '@/services/media/media.service';

import { IconForward, IconLearn } from '../icons';
import { PlateCard, SectionIntro, SectionShell } from '../parts';

/**
 * §products — the course band, from the catalogue.
 *
 * ── Why this queries the database ──────────────────────────────────────────
 *
 * The approved canvas draws six invented course cards, and they were built that
 * way first. They are gone: this band now lists what is actually published, so
 * the homepage and `/courses` can never disagree about what exists, and a card
 * here always leads to a real product page rather than to a catalogue that may
 * not contain it.
 *
 * That makes `/` a dynamic route again — the second recorded exception to the
 * "never change a Prisma query" rule in docs/design-system.md, owner-directed,
 * 2026-08-21. The query is deliberately the same shape as the one on
 * `(public)/courses/page.tsx`: same filter, same ordering, same counting rules,
 * so the two screens cannot drift.
 *
 * ── Three outcomes, kept distinct ─────────────────────────────────────────
 *
 * Products to show, an empty catalogue, and a failure to load. The last two
 * both render NOTHING — the band removes itself. That is deliberate, and it is
 * the one place this page differs from `/courses`, which shows an empty state
 * and an error state: a marketing page that announces «لا توجد دورات» is worse
 * than one that simply does not raise the subject, and a database outage must
 * not put an error panel in the middle of the homepage. Everything else on the
 * page still renders, because nothing else on it touches the database.
 *
 * ── Covers ────────────────────────────────────────────────────────────────
 *
 * `CourseCover` takes the product's cover when an administrator has attached
 * one, and draws the composed brand field when they have not — the same
 * fallback the catalogue pages use, so an unillustrated course is a deliberate,
 * uniform field rather than a hole in the grid.
 */
const PRODUCTS = COPY.landing.products;

/** Six is the canvas's grid: two full rows of three at `lg`. */
const MAX_CARDS = 6;

type LandingCourse = {
  slug: string;
  title: string;
  shortDescription: string;
  level: string | null;
  cover: CoverImage | null;
  moduleCount: number;
  lessonCount: number;
};

async function loadCourses(): Promise<LandingCourse[]> {
  try {
    const rows = await prisma.product.findMany({
      where: { type: 'COURSE', status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      take: MAX_CARDS,
      select: {
        slug: true,
        title: true,
        shortDescription: true,
        /*
         * `visibility` is selected because `mediaAssetUrl` needs it to choose
         * between the public address and the authorising route. A product cover
         * is public, but that rule lives in the helper and is not this
         * component's to duplicate.
         */
        coverAsset: {
          select: { id: true, objectKey: true, visibility: true, width: true, height: true },
        },
        /*
         * Counts are restricted to PUBLISHED content, for the same reason they
         * are on `/courses`: the card states what a visitor would actually
         * receive, and counting drafts advertises lessons nobody can open.
         */
        course: {
          select: {
            category: true,
            level: true,
            _count: { select: { modules: { where: { status: 'PUBLISHED' } } } },
            modules: {
              where: { status: 'PUBLISHED' },
              select: { _count: { select: { lessons: { where: { status: 'PUBLISHED' } } } } },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      shortDescription: row.shortDescription,
      // The chip carries one word. `level` is the more useful of the two when
      // both are set, and `category` stands in when it is not. Both are free
      // text, so they print exactly as an administrator entered them.
      level: row.course?.level ?? row.course?.category ?? null,
      cover: row.coverAsset
        ? {
            url: mediaAssetUrl(row.coverAsset),
            width: row.coverAsset.width,
            height: row.coverAsset.height,
          }
        : null,
      moduleCount: row.course?._count.modules ?? 0,
      lessonCount:
        row.course?.modules.reduce((total, module) => total + module._count.lessons, 0) ?? 0,
    }));
  } catch {
    // An outage takes the band away, not the page. See the note above.
    return [];
  }
}

export async function Products() {
  const courses = await loadCourses();
  if (courses.length === 0) return null;

  return (
    <SectionShell id="products">
      <SectionIntro
        icon={IconLearn}
        eyebrow={PRODUCTS.eyebrow}
        title={PRODUCTS.title}
        lead={PRODUCTS.lead}
      />

      <ul className="mt-13 grid items-stretch gap-5.5 text-start sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course, index) => {
          /*
           * Every meta chip is dropped when its value is zero. «٠ دروس» on a
           * card is a reason not to click; an unfinished course carries one
           * chip fewer instead. Same rule as `ProductGrid`.
           */
          const meta = [
            course.moduleCount ? `${formatNumber(course.moduleCount)} ${COPY.catalog.units}` : null,
            course.lessonCount
              ? `${formatNumber(course.lessonCount)} ${COPY.catalog.lessons}`
              : null,
          ].filter((value): value is string => Boolean(value));

          return (
            <li key={course.slug} className="flex">
              <PlateCard className="reveal flex flex-1 flex-col p-6 sm:p-7.5">
                <div className="border-line-200 relative aspect-[16/10] w-full overflow-hidden rounded-[18px] border">
                  <CourseCover
                    cover={course.cover}
                    // Empty: the card's own heading names the product, and a
                    // cover that repeats the title makes a screen reader read
                    // it twice for one card.
                    alt=""
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 45vw, 380px"
                    className="absolute inset-0"
                  />
                  {course.level ? (
                    <span className="border-line-200 text-brand-800 bg-surface/95 pointer-events-none absolute end-3 top-3 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap">
                      {course.level}
                    </span>
                  ) : null}
                </div>

                <h3 className="text-ink-900 text-h3 mt-5 leading-[1.45]">{course.title}</h3>
                <p className="text-ink-600 mt-3 text-[14.5px] leading-[1.85] font-light">
                  {course.shortDescription}
                </p>

                {meta.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {meta.map((value) => (
                      <span
                        key={value}
                        className="border-line-200/70 bg-canvas text-ink-700 rounded-full border px-3.5 py-[7px] text-[12.5px] whitespace-nowrap"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                ) : null}

                <Link
                  href={`/courses/${course.slug}`}
                  className="text-brand-700 hover:text-brand-900 focus-visible:outline-brand-700 mt-auto flex items-center gap-2 pt-6 text-[14.5px] font-semibold transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {PRODUCTS.cta}
                  {/* Several identical «تفاصيل الدورة» links need distinguishing. */}
                  <span className="sr-only">{` — ${course.title}`}</span>
                  <IconForward className="size-4.5" aria-hidden="true" />
                </Link>
              </PlateCard>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
