import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Headset } from 'lucide-react';

import { Breadcrumbs } from '@/components/marketing/breadcrumbs';
import { CourseCurriculum } from '@/components/marketing/course-curriculum';
import { CourseMasthead } from '@/components/marketing/course-masthead';
import { Container, ErrorState } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { getCourseDetail } from '@/services/catalog/product-detail';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const course = await getCourseDetail(slug, null);
    if (!course) return { title: COPY.errors.notFound };

    return {
      title: course.title,
      description: course.shortDescription,
      openGraph: {
        title: course.title,
        description: course.shortDescription,
        type: 'website',
      },
    };
  } catch {
    return { title: COPY.nav.courses };
  }
}

/**
 * A course's public page.
 *
 * Three objects, in the order somebody deciding actually reads them: the cover
 * plate (what this is, how big it is, and the one control their state calls
 * for), the curriculum (what is inside it), and a rail of standing facts.
 *
 * The page it replaces was a ruled document — correct for the legal pages it
 * shared its head with, and wrong here, because a catalogue page is the object
 * being chosen rather than a record of it. Re-derived 2026-08-21 from the
 * approved canvas «تفاصيل الدورة — بناء العهد الجديد»; the deviations from that
 * artboard are recorded in docs/design-system.md § Catalogue detail, and every
 * one of them is either a claim the database cannot support or a contrast floor.
 *
 * What did NOT change, deliberately: the purchase state is still decided on the
 * server and still chooses between three panels rather than dressing one, the
 * curriculum still locks a lesson nobody has bought, and the route is still
 * `force-dynamic` because both of those read the viewer.
 */
export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const viewer = await getCurrentUser().catch(() => null);

  let course;
  try {
    course = await getCourseDetail(slug, viewer?.id ?? null);
  } catch {
    return (
      <Container className="py-12">
        <ErrorState />
      </Container>
    );
  }

  if (!course) notFound();

  /*
   * The rail repeats nothing the plate already says. `courseIncludes` is part of
   * the buy panel, so it only earns a card of its own once the plate has stopped
   * showing that panel — otherwise the same three lines appear twice on one
   * screen, a few hundred pixels apart.
   */
  const showIncluded = course.purchase.kind !== 'available';

  return (
    <Container className="py-8 lg:py-10">
      <Breadcrumbs
        className="enter"
        items={[
          { label: COPY.nav.home, href: ROUTES.home },
          { label: COPY.nav.courses, href: ROUTES.courses },
          { label: course.title },
        ]}
      />

      <div className="enter mt-4" style={{ '--reveal-delay': '60ms' } as React.CSSProperties}>
        <CourseMasthead course={course} />
      </div>

      <div className="mt-8 grid gap-6 lg:mt-11 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="reveal">
            <CourseCurriculum course={course} />
          </div>

          {course.longDescription ? (
            <section className="reveal rounded-plate border-line-200 from-brand-50/70 to-surface border bg-linear-150 to-45% p-[clamp(20px,2.6vw,34px)]">
              <h2 className="text-h3 text-ink-900">{COPY.catalog.detail.aboutTitle}</h2>
              <p className="text-ink-700 measure-ar-lg mt-4 text-[15.5px] leading-[1.9] whitespace-pre-line">
                {course.longDescription}
              </p>
            </section>
          ) : null}
        </div>

        {/*
         * The rail is sticky from `lg` only, and clears the 96px bar above it.
         * It carries standing facts, never a second control: the one decision on
         * this page is on the plate, and a rail that offered another would make
         * two of them.
         */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
          {showIncluded ? (
            <div className="rounded-shell border-line-200 bg-surface shadow-card border p-5">
              <h2 className="text-h4 text-ink-900">{COPY.catalog.detail.includedTitle}</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {COPY.catalog.panel.courseIncludes.map((line) => (
                  <li key={line} className="text-ink-700 flex items-start gap-2.5 text-[13.5px]">
                    <CheckCircle2
                      className="text-brand-700 mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-shell border-line-200 bg-surface border p-5">
            <h2 className="text-h4 text-ink-900 flex items-center gap-2">
              <Headset className="text-brand-700 size-5 shrink-0" aria-hidden="true" />
              {COPY.contact.eyebrow}
            </h2>
            <p className="text-ink-700 mt-3 text-[13px] leading-[1.85]">
              {COPY.contact.description}
            </p>
            <Link
              href={ROUTES.contact}
              className="border-line-200 text-ink-900 hover:border-brand-500/40 hover:bg-brand-50 hover:text-brand-700 group mt-4 flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-[14px] font-semibold transition-colors duration-150"
            >
              {COPY.nav.contact}
              <ArrowLeft
                className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:-translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
        </aside>
      </div>
    </Container>
  );
}
