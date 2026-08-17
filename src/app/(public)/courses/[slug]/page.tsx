import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, PlayCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge, Card, Container, ErrorState } from '@/components/ui/surface';
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

  return (
    <Container className="py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        {/* Narrative and curriculum lead; the purchase panel is secondary. */}
        <div className="flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">دورة</Badge>
              {course.category ? <Badge>{course.category}</Badge> : null}
              {course.level ? <Badge>{course.level}</Badge> : null}
            </div>

            <h1 className="text-ink-900 text-3xl font-semibold sm:text-4xl">{course.title}</h1>
            <p className="text-ink-700 max-w-2xl text-lg leading-relaxed">
              {course.shortDescription}
            </p>

            <dl className="text-ink-700 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div className="flex gap-1.5">
                <dt>عدد الدروس:</dt>
                <dd className="text-ink-900 font-medium">{formatNumber(course.lessonCount)}</dd>
              </div>
              {/* Shown only when every lesson has a recorded duration. */}
              {course.totalDurationSec !== null ? (
                <div className="flex gap-1.5">
                  <dt>المدة الإجمالية:</dt>
                  <dd className="text-ink-900 font-medium">
                    {formatDurationWords(course.totalDurationSec)}
                  </dd>
                </div>
              ) : null}
              <div className="flex gap-1.5">
                <dt>عدد الوحدات:</dt>
                <dd className="text-ink-900 font-medium">{formatNumber(course.modules.length)}</dd>
              </div>
            </dl>
          </header>

          {course.longDescription ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-ink-900 text-xl font-semibold">عن الدورة</h2>
              <p className="text-ink-700 max-w-2xl leading-relaxed">{course.longDescription}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="text-ink-900 text-xl font-semibold">محتوى الدورة</h2>

            {course.modules.length === 0 ? (
              <p className="text-ink-700">لم تُضَف وحدات بعد.</p>
            ) : (
              <ol className="flex flex-col gap-6">
                {course.modules.map((module, moduleIndex) => (
                  <li key={module.id} className="flex flex-col gap-3">
                    <h3 className="text-ink-900 font-semibold">
                      الوحدة {formatNumber(moduleIndex + 1)}: {module.title}
                    </h3>

                    <ul className="border-line-200 divide-line-200 divide-y rounded-panel border">
                      {module.lessons.map((lesson) => {
                        const openToAll = lesson.isPreview || course.hasAccess;
                        return (
                          <li
                            key={lesson.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <span className="flex items-center gap-3">
                              {openToAll ? (
                                <PlayCircle
                                  className="text-brand-500 size-4 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Lock className="text-ink-600 size-4 shrink-0" aria-hidden="true" />
                              )}
                              <span className="text-ink-900 text-sm">{lesson.title}</span>
                              {lesson.isPreview ? <Badge variant="brand">معاينة</Badge> : null}
                            </span>

                            {lesson.durationSec !== null ? (
                              <span className="text-ink-600 shrink-0 text-sm">
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
          <Card className="flex flex-col gap-4 p-6">
            <p className="text-ink-900 text-2xl font-semibold">
              {formatHalalas(course.priceHalalas)}
            </p>
            <p className="text-ink-700 text-sm">شراء لمرة واحدة. لا اشتراك ولا تجديد تلقائي.</p>

            {course.hasAccess ? (
              <Button asChild size="lg">
                <Link href="/dashboard/courses">ابدأ الدورة</Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href={`/checkout/start?product=${course.slug}`}>اشترِ الدورة</Link>
              </Button>
            )}

            <ul className="text-ink-700 border-line-200 flex flex-col gap-2 border-t pt-4 text-sm">
              <li>وصول دائم بعد الشراء.</li>
              <li>أسئلة قصيرة بعد الدروس التي تتضمنها.</li>
              <li>يحفظ موضع المشاهدة تلقائيًا.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
