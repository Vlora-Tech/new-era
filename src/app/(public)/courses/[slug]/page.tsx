import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, PlayCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge, Card, Container, ErrorState, RuledHead, Subhead } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { formatDurationWords, formatHalalas, formatNumber } from '@/lib/format';
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

  // Only facts the database actually holds. A missing duration is left out
  // rather than shown as zero.
  const facts: { label: string; value: string }[] = [
    { label: 'عدد الوحدات', value: formatNumber(course.modules.length) },
    { label: 'عدد الدروس', value: formatNumber(course.lessonCount) },
  ];
  if (course.totalDurationSec !== null) {
    facts.push({ label: 'المدة الإجمالية', value: formatDurationWords(course.totalDurationSec) });
  }

  return (
    <Container className="py-10 lg:py-16">
      <div className="grid gap-y-14 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-x-16">
        {/* Narrative and curriculum lead; the purchase panel is secondary. */}
        <div>
          <RuledHead>
            <div className="flex flex-wrap items-center gap-2">
              {/* Taxonomy, not status: square labels rather than status pills. */}
              <Badge variant="outline" shape="square">
                {COPY.statusLabels.productType.COURSE}
              </Badge>
              {course.category ? (
                <Badge variant="outline" shape="square">
                  {course.category}
                </Badge>
              ) : null}
              {course.level ? (
                <Badge variant="outline" shape="square">
                  {course.level}
                </Badge>
              ) : null}
            </div>

            <h1 className="text-ink-900 mt-5 text-[30px] leading-[1.28] font-semibold lg:text-[38px] lg:leading-[1.22]">
              {course.title}
            </h1>

            <p className="text-ink-700 measure-ar-lg mt-5 text-[17px] leading-[1.85] lg:text-[18px]">
              {course.shortDescription}
            </p>

            <dl className="border-line-200 mt-8 flex flex-wrap gap-x-10 gap-y-3 border-t pt-5 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-2">
                  <dt className="text-ink-600">{fact.label}</dt>
                  <dd className="text-ink-900 font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </RuledHead>

          {course.longDescription ? (
            <section className="mt-14">
              <Subhead title="عن الدورة" />
              <p className="text-ink-700 measure-ar-lg mt-5 text-[16px] leading-[1.9]">
                {course.longDescription}
              </p>
            </section>
          ) : null}

          <section className="mt-14">
            <Subhead title="محتوى الدورة" />

            {course.modules.length === 0 ? (
              <p className="text-ink-700 mt-5">لم تُضَف وحدات بعد.</p>
            ) : (
              <ol className="mt-8 flex flex-col gap-10">
                {course.modules.map((module, moduleIndex) => (
                  <li key={module.id}>
                    <p className="text-ink-600 text-[12px] font-medium">
                      الوحدة {formatNumber(moduleIndex + 1)}
                    </p>
                    <h3 className="text-ink-900 mt-1.5 text-[18px] leading-[1.5] font-semibold">
                      {module.title}
                    </h3>

                    {/*
                     * Hairlines, not a boxed panel: the curriculum is a record,
                     * and a record is ruled rather than framed.
                     */}
                    <ul className="border-line-200 divide-line-200 mt-4 divide-y border-y">
                      {module.lessons.map((lesson) => {
                        const openToAll = lesson.isPreview || course.hasAccess;
                        return (
                          <li
                            key={lesson.id}
                            className="flex items-center justify-between gap-4 py-3.5"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              {openToAll ? (
                                <PlayCircle
                                  className="text-brand-500 size-4 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <>
                                  <Lock
                                    className="text-ink-600 size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                  {/* The padlock is a shape, but it is not a word. */}
                                  <span className="sr-only">يُفتح بعد الشراء:</span>
                                </>
                              )}
                              <span className="text-ink-900 text-[15px]">{lesson.title}</span>
                              {lesson.isPreview ? <Badge variant="brand">معاينة</Badge> : null}
                            </span>

                            {lesson.durationSec !== null ? (
                              <span className="text-ink-600 shrink-0 text-[13px]">
                                {formatDurationWords(lesson.durationSec)}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Compact purchase summary, sticky on desktop only. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <p className="text-ink-900 text-[28px] leading-none font-semibold">
              {formatHalalas(course.priceHalalas)}
            </p>
            <p className="text-ink-700 mt-3 text-sm leading-[1.8]">
              شراء لمرة واحدة. لا اشتراك ولا تجديد تلقائي.
            </p>

            {course.hasAccess ? (
              <Button asChild size="lg" className="mt-6 w-full">
                <Link href="/dashboard/courses">ابدأ الدورة</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="mt-6 w-full">
                <Link href={`/checkout/start?product=${course.slug}`}>اشترِ الدورة</Link>
              </Button>
            )}

            <ul className="text-ink-700 border-line-200 divide-line-200 mt-6 divide-y border-t text-sm">
              <li className="py-2.5">وصول دائم بعد الشراء.</li>
              <li className="py-2.5">أسئلة قصيرة بعد الدروس التي تتضمنها.</li>
              <li className="py-2.5">يحفظ موضع المشاهدة تلقائيًا.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
