import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Lock } from 'lucide-react';

import { ProtectedPlayer } from '@/components/video/protected-player';
import { Button } from '@/components/ui/button';
import { Badge, ErrorState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { formatNumber } from '@/lib/format';
import { getLearningView } from '@/services/courses/learning';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ courseSlug: string; lessonId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseSlug } = await params;
  return { title: courseSlug };
}

export default async function LessonPage({ params }: PageProps) {
  const { courseSlug, lessonId } = await params;
  const user = await requireUserPage(`/learn/${courseSlug}/${lessonId}`);

  let view;
  try {
    view = await getLearningView(courseSlug, lessonId, user.id);
  } catch {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <ErrorState />
      </main>
    );
  }

  if (!view) notFound();

  const openToThisStudent = view.hasAccess || view.lesson.isPreview;

  return (
    <div className="bg-canvas flex min-h-dvh flex-col">
      {/* A quiet bar: the way back to the course, and nothing else competing. */}
      <header className="border-line-200 bg-surface border-b">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-4 px-4">
          <Link
            href={`/courses/${view.courseSlug}`}
            className="text-ink-700 hover:text-brand-700 flex items-center gap-2 text-sm font-medium"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            {view.courseTitle}
          </Link>
          <Link href="/dashboard/courses" className="text-ink-700 hover:text-brand-700 text-sm">
            {COPY.dashboard.myCourses}
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6">
        <article className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-ink-900 text-2xl font-semibold">{view.lesson.title}</h1>
            {view.lesson.isPreview ? <Badge variant="brand">معاينة</Badge> : null}
            {view.lesson.completed ? <Badge variant="success">مكتمل</Badge> : null}
          </div>

          {!openToThisStudent ? (
            <div className="border-line-200 bg-surface flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-panel border">
              <Lock className="text-ink-600 size-7" aria-hidden="true" />
              <p className="text-ink-900 font-medium">هذا الدرس متاح بعد شراء الدورة.</p>
              <Button asChild size="sm">
                <Link href={`/courses/${view.courseSlug}`}>عرض الدورة</Link>
              </Button>
            </div>
          ) : view.lesson.hasVideo ? (
            <ProtectedPlayer lessonId={view.lesson.id} title={view.lesson.title} />
          ) : (
            // Honest about the real state rather than showing a broken player.
            <div className="border-line-200 bg-surface-muted flex aspect-video w-full items-center justify-center rounded-panel border">
              <p className="text-ink-700 text-sm">لم يُربط مقطع بهذا الدرس بعد.</p>
            </div>
          )}

          {openToThisStudent && view.lesson.content ? (
            <div className="text-ink-700 leading-relaxed">{view.lesson.content}</div>
          ) : null}

          <nav
            aria-label="التنقل بين الدروس"
            className="border-line-200 flex items-center justify-between gap-3 border-t pt-5"
          >
            {view.previousLessonId ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/learn/${view.courseSlug}/${view.previousLessonId}`}>
                  <ArrowRight className="size-4" aria-hidden="true" />
                  {COPY.common.previous}
                </Link>
              </Button>
            ) : (
              <span />
            )}

            {view.nextLessonId ? (
              <Button asChild size="sm">
                <Link href={`/learn/${view.courseSlug}/${view.nextLessonId}`}>
                  {COPY.common.next}
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        </article>

        {/* Curriculum is secondary: present, scannable, easy to ignore. */}
        <aside className="border-line-200 bg-surface h-fit rounded-panel border p-4 lg:sticky lg:top-6">
          <h2 className="text-ink-900 mb-3 text-sm font-semibold">محتوى الدورة</h2>

          <ol className="flex flex-col gap-4">
            {view.curriculum.map((module, moduleIndex) => (
              <li key={module.moduleId} className="flex flex-col gap-2">
                <p className="text-ink-600 text-xs font-medium">
                  الوحدة {formatNumber(moduleIndex + 1)} — {module.moduleTitle}
                </p>

                <ul className="flex flex-col">
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/learn/${view.courseSlug}/${lesson.id}`}
                        aria-current={lesson.isCurrent ? 'page' : undefined}
                        className={
                          lesson.isCurrent
                            ? 'bg-brand-100 text-brand-700 flex items-start gap-2 rounded-control px-2 py-2 text-sm font-medium'
                            : 'text-ink-700 hover:bg-surface-muted flex items-start gap-2 rounded-control px-2 py-2 text-sm'
                        }
                      >
                        {/* Completion is shown by icon and by label, never by colour alone. */}
                        {lesson.completed ? (
                          <CheckCircle2
                            className="text-success mt-0.5 size-4 shrink-0"
                            aria-label="مكتمل"
                          />
                        ) : (
                          <Circle className="text-ink-600 mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>{lesson.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  );
}
