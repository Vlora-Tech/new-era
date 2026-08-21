import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, ListChecks, Lock, Play } from 'lucide-react';

import { LessonQuiz } from '@/components/learn/lesson-quiz';
import { ProtectedPlayer } from '@/components/video/protected-player';
import { Button } from '@/components/ui/button';
import { Badge, Card, ErrorState } from '@/components/ui/surface';
import { requireUserPage } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { fillTemplate } from '@/lib/exam/template';
import { formatCount, formatDurationWords, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getLearningView } from '@/services/courses/learning';
import { getLessonQuizView } from '@/services/courses/lesson-quiz.service';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ courseSlug: string; lessonId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { courseSlug } = await params;
  return { title: courseSlug };
}

/**
 * A dot-separated meta line, each run bidi-isolated.
 *
 * The isolation is load-bearing, not tidiness. «وحدتان · ٥ دروس» mixes a
 * right-to-left run with an Arabic-Indic numeral, and the bidi algorithm
 * resolves the neutral «·» into the number's run — so the separator lands
 * against the ٥ and the line reads as «وحدتان ٥٠ دروس». `<bdi>` closes each run
 * off, which is exactly what the element is for.
 */
function MetaLine({ parts, className }: { parts: string[]; className?: string }) {
  if (parts.length === 0) return null;

  return (
    <span className={className}>
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 ? (
            <span aria-hidden="true" className="text-line-500 mx-1.5">
              ·
            </span>
          ) : null}
          <bdi>{part}</bdi>
        </span>
      ))}
    </span>
  );
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

  /*
   * Server-rendered with the page rather than fetched by the client on mount.
   * The quiz is part of the lesson, not an afterthought bolted below it, and a
   * skeleton that resolves a beat later would say otherwise. `getLessonQuizView`
   * re-decides access itself and answers null for a lesson this student may not
   * open, so the failure mode of getting this wrong is a missing section rather
   * than a leaked one — and the `hasQuiz` short-circuit is an optimisation over
   * a check that has already been made, never a substitute for it.
   */
  const quizView = view.lesson.hasQuiz
    ? await getLessonQuizView(view.lesson.id, user.id).catch(() => null)
    : null;

  /*
   * Course progress, counted from the curriculum the view already carries — no
   * second query. It is the one number that tells a student where they are in
   * something longer than the screen in front of them.
   */
  const allLessons = view.curriculum.flatMap((module) => module.lessons);
  const completedCount = allLessons.filter((lesson) => lesson.completed).length;
  const totalCount = allLessons.length;
  const percentComplete = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Which module the current lesson sits in, for the line above its title.
  const currentModuleIndex = view.curriculum.findIndex((module) =>
    module.lessons.some((lesson) => lesson.isCurrent),
  );
  const currentModule = currentModuleIndex >= 0 ? view.curriculum[currentModuleIndex] : undefined;

  const lessonMeta = [
    currentModule
      ? fillTemplate(COPY.learn.moduleOrdinal, {
          index: formatNumber(currentModuleIndex + 1),
          title: currentModule.moduleTitle,
        })
      : null,
    view.lesson.durationSec !== null ? formatDurationWords(view.lesson.durationSec) : null,
  ].filter((part): part is string => Boolean(part));

  /*
   * The counted nouns are the catalogue's, not a second copy of them. They name
   * the same two objects a student just read about on the product page, and the
   * copy bank keeps one wording for one thing.
   */
  const curriculumSummary = [
    formatCount(view.curriculum.length, COPY.catalog.detail.counts.units),
    formatCount(totalCount, COPY.catalog.detail.counts.lessons),
  ];

  return (
    <div className="bg-canvas flex min-h-dvh flex-col">
      {/*
       * A quiet bar that stays: the way back to the course, which course is
       * being studied, and how far through it the student is. It follows the
       * page because the curriculum rail scrolls away on a long lesson and the
       * way out should not go with it.
       */}
      <header className="border-line-200 bg-canvas/85 sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-5 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3.5">
            <Link
              href={`/courses/${view.courseSlug}`}
              aria-label={COPY.learn.backToCourse}
              className="border-line-200 bg-surface text-ink-700 rounded-control hover:border-brand-500/40 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-brand-500 flex size-10 shrink-0 items-center justify-center border shadow-xs transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {/* Back is right in RTL. */}
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>

            <div className="min-w-0">
              <p className="text-ink-600 text-[11.5px] font-medium">{COPY.learn.courseEyebrow}</p>
              <p className="text-ink-900 truncate text-[15px] font-semibold">{view.courseTitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            {totalCount > 0 ? (
              <div className="hidden items-center gap-2.5 sm:flex">
                <span className="text-ink-700 text-[12.5px] whitespace-nowrap tabular-nums">
                  {fillTemplate(COPY.learn.progressLabel, {
                    done: formatNumber(completedCount),
                    total: formatNumber(totalCount),
                  })}
                </span>
                {/* The sentence beside it already carries the number, so the
                    meter is a picture of it and nothing more. */}
                <span
                  aria-hidden="true"
                  className="bg-line-200 block h-1.5 w-[110px] overflow-hidden rounded-full"
                >
                  <span
                    className="bg-gradient-meter block h-full rounded-full"
                    style={{ width: `${percentComplete}%` }}
                  />
                </span>
              </div>
            ) : null}

            <Button asChild variant="secondary" size="sm" shape="pill">
              <Link href="/dashboard/courses">{COPY.dashboard.myCourses}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 items-start gap-6 px-4 pt-6 pb-24 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-7 lg:px-8">
        <article className="flex min-w-0 flex-col gap-6 lg:gap-7">
          {!openToThisStudent ? (
            <div className="border-line-200 bg-surface rounded-card shadow-card flex aspect-video w-full flex-col items-center justify-center gap-3 border">
              <Lock className="text-ink-600 size-7" aria-hidden="true" />
              <p className="text-ink-900 font-medium">{COPY.learn.lockedTitle}</p>
              <Button asChild size="sm">
                <Link href={`/courses/${view.courseSlug}`}>{COPY.learn.lockedAction}</Link>
              </Button>
            </div>
          ) : view.lesson.hasVideo ? (
            <ProtectedPlayer lessonId={view.lesson.id} title={view.lesson.title} />
          ) : (
            // Honest about the real state rather than showing a broken player.
            <div className="border-line-200 bg-surface-muted rounded-card flex aspect-video w-full items-center justify-center border">
              <p className="text-ink-700 text-sm">{COPY.learn.noVideo}</p>
            </div>
          )}

          {/* Title, standing, with the way onward beside it rather than buried
              under the fold at the end of the page. */}
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
            <div className="min-w-0 flex-1 basis-[22rem]">
              <div className="flex flex-wrap items-center gap-2.5">
                {view.lesson.isPreview ? (
                  <Badge variant="brand">{COPY.learn.lessonPreview}</Badge>
                ) : null}
                {view.lesson.completed ? (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {COPY.learn.lessonCompleted}
                  </Badge>
                ) : null}
                <MetaLine parts={lessonMeta} className="text-ink-600 text-[12.5px]" />
              </div>

              <h1 className="text-ink-900 text-h2-tight mt-3.5">{view.lesson.title}</h1>

              {openToThisStudent && view.lesson.content ? (
                <p className="text-ink-700 text-lead measure-lead mt-3">{view.lesson.content}</p>
              ) : null}
            </div>

            <nav
              aria-label={COPY.learn.navigationLabel}
              className="flex shrink-0 flex-wrap items-center gap-2.5"
            >
              {view.previousLessonId ? (
                <Button asChild variant="outline" shape="pill">
                  <Link href={`/learn/${view.courseSlug}/${view.previousLessonId}`}>
                    <ArrowRight className="size-4" aria-hidden="true" />
                    {COPY.common.previous}
                  </Link>
                </Button>
              ) : null}

              {view.nextLessonId ? (
                <Button asChild shape="pill">
                  <Link href={`/learn/${view.courseSlug}/${view.nextLessonId}`}>
                    {COPY.common.next}
                    {/* Forward is left in RTL. */}
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
            </nav>
          </div>

          {/*
           * The short quiz, between the lesson and the way out of it. A student
           * who has watched the video is meant to meet the check before the
           * "next lesson" button, not after they have already left.
           */}
          {quizView ? (
            <>
              <div className="bg-line-200 h-px" aria-hidden="true" />
              <LessonQuiz lessonId={view.lesson.id} initialView={quizView} />
            </>
          ) : null}
        </article>

        {/* Curriculum is secondary: present, scannable, easy to ignore. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="rounded-card overflow-hidden">
            <div className="border-line-200 bg-brand-50/60 border-b px-5 py-4">
              <h2 className="text-ink-900 text-h4">{COPY.learn.curriculumTitle}</h2>
              <MetaLine
                parts={curriculumSummary}
                className="text-ink-700 mt-1 block text-[12.5px]"
              />
            </div>

            <ol className="flex flex-col gap-3 p-3">
              {view.curriculum.map((module, moduleIndex) => (
                <li key={module.moduleId}>
                  <p className="text-ink-600 px-2 pt-1 pb-2 text-[11.5px] font-medium">
                    {fillTemplate(COPY.learn.moduleOrdinal, {
                      index: formatNumber(moduleIndex + 1),
                      title: module.moduleTitle,
                    })}
                  </p>

                  <ul className="flex flex-col gap-1">
                    {module.lessons.map((lesson) => {
                      /* Never colour alone: the row says which state it is in. */
                      const status = lesson.isCurrent
                        ? COPY.learn.lessonCurrent
                        : lesson.completed
                          ? COPY.learn.lessonCompleted
                          : lesson.isPreview
                            ? COPY.learn.lessonPreview
                            : null;

                      return (
                        <li key={lesson.id}>
                          <Link
                            href={`/learn/${view.courseSlug}/${lesson.id}`}
                            aria-current={lesson.isCurrent ? 'page' : undefined}
                            className={cn(
                              'rounded-panel flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 ease-out',
                              lesson.isCurrent ? 'bg-brand-50' : 'hover:bg-surface-muted',
                            )}
                          >
                            <span
                              className={cn(
                                'rounded-control flex size-8 shrink-0 items-center justify-center',
                                lesson.isCurrent
                                  ? 'bg-brand-700 text-white'
                                  : lesson.completed
                                    ? 'bg-success-soft text-success'
                                    : 'bg-surface-muted text-ink-600',
                              )}
                            >
                              {lesson.completed && !lesson.isCurrent ? (
                                <CheckCircle2 className="size-4" aria-hidden="true" />
                              ) : (
                                <Play className="size-4" aria-hidden="true" />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  'block truncate text-[14px]',
                                  lesson.isCurrent
                                    ? 'text-brand-700 font-semibold'
                                    : 'text-ink-900 font-medium',
                                )}
                              >
                                {lesson.title}
                              </span>
                              {status ? (
                                <span
                                  className={cn(
                                    'mt-0.5 block text-[12px]',
                                    // ink-600 is below the floor on a tinted
                                    // ground; the active row takes brand ink.
                                    lesson.isCurrent ? 'text-brand-700' : 'text-ink-600',
                                  )}
                                >
                                  {status}
                                </span>
                              ) : null}
                            </span>

                            {/* The glyph is a shape, not a word: the label carries
                                the meaning for anyone who cannot see it. */}
                            {lesson.hasQuiz ? (
                              <ListChecks
                                className={cn(
                                  'size-4 shrink-0',
                                  lesson.isCurrent ? 'text-brand-700' : 'text-ink-600',
                                )}
                                aria-label={COPY.lessonQuiz.curriculumMarker}
                              />
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </main>
    </div>
  );
}
