import Link from 'next/link';
import { ChevronLeft, Lock, Play } from 'lucide-react';

import { Badge } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { fillTemplate } from '@/lib/exam/template';
import { formatCount, formatDurationWords, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CourseDetail } from '@/services/catalog/product-detail';

/**
 * The curriculum, as a panel of ruled modules.
 *
 * This replaces the hairline record the page carried before. The record was
 * right for a document and wrong for this page: a course's modules are objects a
 * student is deciding between, and the ruled version gave a module header the
 * same weight as the lesson under it, so a three-module course read as one long
 * list of thirty lines.
 *
 * ── What is a link and what is not ─────────────────────────────────────────
 *
 * Unchanged from the previous page, because it is the access model rather than
 * a style: a lesson opens when it is a preview, or when the viewer owns the
 * course. Anything else is inert — not a link, and therefore not a tab stop
 * either — and its padlock is paired with an `sr-only` phrase, because a shape
 * is not a word.
 *
 * The canvas draws every row as openable with a chevron on it. That is the
 * owner's view of a course, which is the state an artboard naturally shows; the
 * locked row is the state that actually protects the content.
 */
export function CourseCurriculum({ course }: { course: CourseDetail }) {
  const DETAIL = COPY.catalog.detail;

  const summary = [
    formatCount(course.modules.length, DETAIL.counts.units),
    formatCount(course.lessonCount, DETAIL.counts.lessons),
    course.totalDurationSec !== null ? formatDurationWords(course.totalDurationSec) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="rounded-plate border-line-200 bg-surface shadow-card border p-[clamp(20px,2.6vw,34px)]">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div>
          {/* The canvas's short gradient rule. It is the `RuledHead` figure
              without the full-width hairline, which inside a panel would draw a
              second edge a few pixels from the panel's own. */}
          <span aria-hidden="true" className="bg-gradient-meter block h-1 w-11 rounded-full" />
          <h2 className="text-h2-tight text-ink-900 mt-4">{DETAIL.curriculumTitle}</h2>
        </div>
        {course.modules.length > 0 ? <p className="text-ink-600 text-[13px]">{summary}</p> : null}
      </div>

      {course.modules.length === 0 ? (
        <p className="text-ink-700 mt-6 text-[15px]">{DETAIL.noModules}</p>
      ) : (
        <ol className="mt-6 flex flex-col gap-4">
          {course.modules.map((module, moduleIndex) => (
            <li key={module.id} className="border-line-200 rounded-card overflow-hidden border">
              <div className="border-line-200 from-brand-50 to-surface flex items-center justify-between gap-3 border-b bg-linear-150 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-brand-700 rounded-control font-display flex size-8 shrink-0 items-center justify-center text-[14px] font-semibold text-white tabular-nums"
                  >
                    {formatNumber(moduleIndex + 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink-600 text-[11.5px]">
                      {fillTemplate(DETAIL.moduleOrdinal, {
                        index: formatNumber(moduleIndex + 1),
                      })}
                    </p>
                    <h3 className="text-h4 text-ink-900 mt-0.5 truncate">{module.title}</h3>
                  </div>
                </div>
                <p className="text-ink-600 shrink-0 text-[12.5px]">
                  {formatCount(module.lessons.length, DETAIL.counts.lessons)}
                </p>
              </div>

              <ul className="divide-line-200 divide-y">
                {module.lessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} course={course} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LessonRow({
  lesson,
  course,
}: {
  lesson: CourseDetail['modules'][number]['lessons'][number];
  course: CourseDetail;
}) {
  const DETAIL = COPY.catalog.detail;
  const openToAll = lesson.isPreview || course.hasAccess;

  return (
    <li
      /*
       * `relative` anchors the playable row's full-row hit area below: the link
       * spreads to the row with `after:inset-0`, so the target is the row and
       * not the title's own text box.
       */
      className={cn(
        'relative flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-150',
        openToAll && 'group hover:bg-brand-50/60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-control flex size-9 shrink-0 items-center justify-center',
          openToAll ? 'bg-brand-100 text-brand-700' : 'bg-surface-muted text-ink-600',
        )}
      >
        {openToAll ? <Play className="size-4 fill-current" /> : <Lock className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        {openToAll ? (
          <Link
            href={`/learn/${course.slug}/${lesson.id}`}
            className="text-ink-900 group-hover:text-brand-700 rounded-control block truncate text-[15px] font-medium transition-colors duration-150 after:absolute after:inset-0"
          >
            {lesson.title}
          </Link>
        ) : (
          <p className="text-ink-900 truncate text-[15px] font-medium">
            {/* The padlock is a shape, but it is not a word. */}
            <span className="sr-only">{DETAIL.lockedPrefix} </span>
            {lesson.title}
          </p>
        )}
        {lesson.durationSec !== null ? (
          <p className="text-ink-600 mt-0.5 text-[12.5px]">
            {formatDurationWords(lesson.durationSec)}
          </p>
        ) : null}
      </div>

      {lesson.isPreview ? (
        <Badge variant="success">{DETAIL.previewBadge}</Badge>
      ) : openToAll ? (
        <ChevronLeft
          className="text-line-500 group-hover:text-brand-700 size-5 shrink-0 transition-colors duration-150"
          aria-hidden="true"
        />
      ) : null}
    </li>
  );
}
