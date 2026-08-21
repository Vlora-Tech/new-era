import type { ComponentType, SVGProps } from 'react';
import { Clock3, Layers, PlayCircle } from 'lucide-react';

import { CourseCover } from '@/components/marketing/course-cover';
import { PurchasePanel } from '@/components/marketing/purchase-panel';
import { COPY } from '@/lib/copy';
import { formatDurationWords, formatNumber } from '@/lib/format';
import type { CourseDetail } from '@/services/catalog/product-detail';

/**
 * The course page's masthead: a cover plate carrying the title, the taxonomy,
 * the three figures the database actually holds, and the decision panel.
 *
 * ── Why this is a dark plate on a light-only site ──────────────────────────
 *
 * Because it is a cover, not a section. `marketing/course-cover.tsx` already
 * draws this exact field on every catalogue card and states the argument there:
 * imagery inside a bounded frame is allowed to be dark for the same reason a
 * photograph is, and the frame is what keeps it from being a dark theme. This
 * is that object at plate scale, and it is the same object — a product with a
 * cover carries it from the grid straight into this masthead, so the page a
 * student clicks into is visibly the card they clicked.
 *
 * The plate is `rounded-plate` (26px) rather than the canvas's 30px: the system
 * has six radii already and a seventh, four pixels from an existing one, would
 * be a value nobody could pick correctly again.
 *
 * ── The figures ────────────────────────────────────────────────────────────
 *
 * Label above, numeral below, which sidesteps Arabic pluralisation entirely:
 * «الدروس ٢» is correct where «٢ دروس» is not, and the alternative was a
 * dual/plural table for one line of chrome. A missing total duration is dropped
 * rather than printed as zero — the same rule the catalogue card follows, and
 * the reason is that "no recorded duration" and "very short" are different
 * claims.
 */
export function CourseMasthead({ course }: { course: CourseDetail }) {
  const DETAIL = COPY.catalog.detail;

  const stats: Array<{
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    label: string;
    value: string;
  }> = [
    {
      icon: Layers,
      label: DETAIL.statUnits,
      value: formatNumber(course.modules.length),
    },
    {
      icon: PlayCircle,
      label: DETAIL.statLessons,
      value: formatNumber(course.lessonCount),
    },
  ];

  if (course.totalDurationSec !== null) {
    stats.push({
      icon: Clock3,
      label: DETAIL.statDuration,
      value: formatDurationWords(course.totalDurationSec),
    });
  }

  const tags = [COPY.statusLabels.productType.COURSE, course.category, course.level].filter(
    (tag): tag is string => Boolean(tag),
  );

  return (
    <div className="rounded-plate shadow-plate relative isolate overflow-hidden">
      {/*
        `alt` is empty on purpose: the h1 below names the course, and a cover
        that repeats it makes a screen reader read the title twice. `priority`
        because this is the page's largest contentful paint.
      */}
      <CourseCover
        cover={course.cover}
        alt=""
        scale="plate"
        priority
        sizes="(min-width: 1320px) 1240px, 100vw"
        className="absolute inset-0"
      />

      <div className="relative grid gap-8 p-[clamp(24px,3.4vw,58px)] lg:grid-cols-[minmax(0,1.15fr)_auto] lg:items-end lg:gap-[clamp(28px,3vw,52px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className={
                  index === 0
                    ? 'text-cover-900 rounded-full bg-white px-4 py-2 text-[12px] font-semibold'
                    : 'rounded-full border border-white/30 bg-white/15 px-4 py-2 text-[12px] font-medium text-white'
                }
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-h1 mt-5 text-white">{course.title}</h1>

          <p className="text-lead-lg measure-lead mt-4 text-white/80">{course.shortDescription}</p>

          <dl className="mt-7 flex flex-wrap items-end gap-x-[clamp(14px,2vw,34px)] gap-y-5">
            {stats.map((stat, index) => (
              <div key={stat.label} className="flex items-end gap-[clamp(14px,2vw,34px)]">
                {/* Hidden below `lg`, where the row wraps: a separator that
                    survives the wrap starts the second line with a rule
                    dividing nothing. */}
                {index > 0 ? (
                  <span aria-hidden="true" className="hidden h-9 w-px bg-white/20 lg:block" />
                ) : null}
                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] text-white/70">
                    <stat.icon className="size-4 shrink-0" aria-hidden="true" />
                    {stat.label}
                  </dt>
                  <dd className="font-display mt-1.5 text-[19px] font-semibold text-white tabular-nums">
                    {stat.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/*
          The panel, on the plate rather than in the rail. Which of the three
          panels this is remains `PurchasePanel`'s decision — the plate supplies
          a ground and nothing else. On a phone the grid collapses and it sits
          below the title, still inside the frame.
        */}
        <div className="w-full lg:w-[340px]">
          <PurchasePanel
            kind="course"
            surface="cover"
            purchase={course.purchase}
            ownerProgress={course.ownerProgress}
            priceHalalas={course.priceHalalas}
            slug={course.slug}
          />
        </div>
      </div>
    </div>
  );
}
