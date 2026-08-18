import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

import { IconCourses, IconForward, IconTimer } from '../icons';
import { CoursePlayerMockup } from '../mockups/course-player';
import { ExamQuestionMockup } from '../mockups/exam';
import { CheckList, Eyebrow, revealDelay, SectionShell, SpecimenLabel } from '../parts';

/**
 * The two catalogue panels — courses, then simulators.
 *
 * They are deliberately not mirror images. Courses is a plain split on the
 * section's own ground; simulators sits inside a bordered, tinted shell. The
 * asymmetry is what stops the pair reading as a comparison table: these are two
 * different products bought for two different reasons, not two tiers of one.
 *
 * `#courses` and `#sims` are both real anchors — the header and footer link to
 * them, and the design nests the second inside the first's section, which is
 * why `#sims` is a `div` with its own scroll margin rather than a `section`.
 */
const COURSES = COPY.landing.courses;
const SIMULATORS = COPY.landing.simulators;

export function Catalogue() {
  return (
    <SectionShell id="courses">
      {/* Courses */}
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="reveal">
          <Eyebrow icon={IconCourses}>{COURSES.eyebrow}</Eyebrow>
          <h2 className="text-ink-900 text-h2 mt-6">{COURSES.title}</h2>
          <p className="text-ink-700 text-lead measure-ar mt-5">{COURSES.lead}</p>
          <CheckList items={COURSES.bullets} className="mt-7" />
          <Button asChild variant="gradient" shape="pill" size="lg" className="mt-8">
            <Link href="/courses">
              {COURSES.cta}
              <IconForward className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="reveal" style={revealDelay(90)}>
          <div aria-hidden="true">
            <CoursePlayerMockup />
          </div>
          <SpecimenLabel className="mt-3" />
        </div>
      </div>

      {/* Simulators */}
      <div
        id="sims"
        className="rounded-shell border-line-200 reveal from-brand-50 mt-16 scroll-mt-24 border bg-linear-to-br to-white p-6 sm:p-8 lg:mt-24 lg:p-11"
      >
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow icon={IconTimer}>{SIMULATORS.eyebrow}</Eyebrow>
            <h2 className="text-ink-900 text-h2 mt-6">{SIMULATORS.title}</h2>
            <p className="text-ink-700 text-lead measure-ar mt-5">{SIMULATORS.lead}</p>

            <dl className="mt-7 flex flex-wrap gap-3">
              {SIMULATORS.meta.map((item) => (
                <div
                  key={item.label}
                  className="rounded-panel border-line-200 bg-surface border px-4 py-3 shadow-xs"
                >
                  <dt className="text-ink-600 text-[12.5px]">{item.label}</dt>
                  <dd className="font-display text-ink-900 mt-0.5 text-[16px] font-semibold">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Button asChild variant="gradient" shape="pill" size="lg" className="mt-8">
              <Link href="/simulators">
                {SIMULATORS.cta}
                <IconForward className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div>
            <div aria-hidden="true">
              <ExamQuestionMockup />
            </div>
            <SpecimenLabel className="mt-3" />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
