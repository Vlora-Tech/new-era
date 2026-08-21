import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

import { IconAutosave, IconForward, IconInfo, IconSelected, IconTimer } from '../icons';
import { BrowserChrome, Chip, OptionRow } from '../parts';

/**
 * Drawings of the exam workspace.
 *
 * Two sizes of the same figure: a bare question card for the simulators panel,
 * and the full windowed screen — question map, autosave, irreversible-advance
 * note — for the demo section.
 *
 * The specimen questions are the platform's own, authored for this purpose and
 * held in `COPY.landing.mock`. They are not, and must never become, real exam
 * items: the regulation governing the official test treats its questions as
 * confidential intellectual property, which is the same constraint the rights
 * section of this page states out loud.
 *
 * `noReturnNote` is the marketing shorthand for the third rule in
 * `COPY.exam.rules` — advancing a section is irreversible. It is stated here so
 * that a student meets the rule before paying, not after starting a clock.
 */
const MOCK = COPY.landing.mock;

/** The header strip every exam drawing shares: section name, clock, position. */
function ExamHeader({
  section,
  clock,
  position,
}: {
  section: string;
  clock: string;
  position: string;
}) {
  return (
    <div className="border-line-200/60 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <Chip>{section}</Chip>
      <span className="text-ink-700 flex items-center gap-1.5 text-[13px] font-semibold">
        <IconTimer className="size-4" />
        <span className="tabular-nums">{clock}</span>
      </span>
      <span className="text-ink-500 text-[12.5px]">{position}</span>
    </div>
  );
}

/** The autosave chip and forward control, drawn as the workspace shows them. */
function ExamFooter({ savedLabel }: { savedLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <span className="text-success flex items-center gap-1.5 text-[12.5px] font-medium">
        <IconAutosave className="size-4" />
        {savedLabel}
      </span>
      <span className="bg-gradient-brand flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white">
        {MOCK.next}
        <IconForward className="size-3.5" />
      </span>
    </div>
  );
}

/** The compact question card, for the simulators panel. */
export function ExamQuestionMockup() {
  return (
    <div className="rounded-card border-line-200/70 bg-surface shadow-card overflow-hidden border">
      <ExamHeader
        section={MOCK.verbalSection}
        clock={MOCK.sectionClock}
        position={MOCK.questionEighteen}
      />

      <div className="p-4">
        <p className="text-ink-600 text-[12.5px]">{MOCK.verbalPrompt}</p>
        <p className="text-ink-900 mt-2 text-[15px] leading-relaxed font-semibold">
          {MOCK.verbalStem}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {MOCK.verbalOptions.map((option, index) => (
            <OptionRow
              key={option}
              letter={MOCK.optionLetters[index]}
              label={option}
              selected={index === 1}
              icon={IconSelected}
            />
          ))}
        </div>
      </div>

      <div className="border-line-200/60 border-t">
        <ExamFooter savedLabel={MOCK.answerSaved} />
      </div>
    </div>
  );
}

/**
 * The full windowed simulator screen, for the demo section.
 *
 * The question map reflows below the question at narrow widths rather than
 * squeezing into a column, and the whole grid collapses to one column under
 * `lg` — a 12-cell grid beside a paragraph of Arabic is unreadable on a phone.
 */
export function SimulatorScreenMockup() {
  return (
    <div className="rounded-card border-line-200/70 bg-surface overflow-hidden border">
      <BrowserChrome title={MOCK.demoWindowTitle} />

      <ExamHeader
        section={MOCK.verbalSection}
        clock={MOCK.timeRemaining}
        position={MOCK.questionEighteen}
      />

      <div className="grid gap-5 p-5 text-start lg:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <p className="text-ink-600 text-[13px]">{MOCK.demoPrompt}</p>
          <p className="text-ink-900 mt-2.5 text-[16px] leading-relaxed font-semibold">
            {MOCK.demoStem}
          </p>

          <div className="mt-4 flex flex-col gap-2.5">
            {MOCK.demoOptions.map((option, index) => (
              <OptionRow
                key={option}
                letter={MOCK.optionLetters[index]}
                label={option}
                selected={index === 1}
                icon={IconSelected}
              />
            ))}
          </div>

          <div className="border-line-200/60 mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3.5">
            <span className="text-success flex items-center gap-1.5 text-[12.5px] font-medium">
              <IconAutosave className="size-4" />
              {MOCK.answerSavedAuto}
            </span>
            <span className="flex items-center gap-2">
              <span className="border-line-200 text-ink-700 rounded-full border px-4 py-2 text-[13px] font-medium">
                {MOCK.previous}
              </span>
              <span className="bg-gradient-brand flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white">
                {MOCK.next}
                <IconForward className="size-3.5" />
              </span>
            </span>
          </div>
        </div>

        <div className="rounded-panel border-line-200/70 bg-brand-50 border p-4">
          <p className="text-ink-900 text-[13px] font-semibold">{MOCK.questionMap}</p>

          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {Array.from({ length: 24 }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'rounded-[6px] py-1 text-center text-[11px] font-medium tabular-nums',
                  index < 17 && 'bg-brand-700 text-white',
                  index === 17 && 'bg-brand-100 text-brand-700 ring-brand-500 ring-2',
                  index > 17 && 'bg-surface text-ink-500 border-line-200 border',
                )}
              >
                {index + 1}
              </span>
            ))}
          </div>

          <p className="text-ink-600 mt-3 flex items-center gap-1.5 text-[11.5px]">
            <span className="bg-brand-700 size-2.5 shrink-0 rounded-[3px]" />
            {MOCK.answeredLegend}
          </p>

          <p className="text-ink-700 border-line-200/70 mt-3 flex items-start gap-1.5 border-t pt-3 text-[11.5px] leading-relaxed">
            <IconInfo className="mt-0.5 size-3.5 shrink-0" />
            <span>{MOCK.noReturnNote}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
