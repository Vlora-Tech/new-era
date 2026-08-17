import { ArrowLeft, Check, Flag } from 'lucide-react';

import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';

/**
 * The homepage hero's facing plate: a faithful, deliberately composed drawing of
 * the product's own practice-question interface — question header, section
 * ruler, options with a selected state, and the workspace's action row.
 *
 * It is drawn flat. No shadow, no lift, no floating satellites orbiting it: the
 * plate is a specimen page held beside the argument, not a screenshot pretending
 * to hover in space. Depth here comes from the rules and the fills.
 *
 * The question is an original sample authored for the platform, and the whole
 * plate is `aria-hidden` — the surrounding copy states the same facts, and a
 * screen reader gains nothing from walking a sample question. No statistic,
 * score, percentage or count about the business is claimed anywhere in it.
 */
const OPTIONS = [
  { label: 'مقص : قص', selected: true },
  { label: 'ورق : شجرة', selected: false },
  { label: 'كتاب : مكتبة', selected: false },
  { label: 'حبر : أزرق', selected: false },
] as const;

const TOTAL_QUESTIONS = 24;
const CURRENT_QUESTION = 7;

export function StudyArtifact({ className }: { className?: string }) {
  return (
    <div
      className={cn('border-line-200 bg-surface border p-5 sm:p-6', className)}
      aria-hidden="true"
    >
      {/* Workspace header: skill label and position, exactly as the product names them. */}
      <div className="border-line-200 flex items-baseline justify-between gap-4 border-b pb-3">
        <span className="text-brand-700 text-[13px] font-semibold">التناظر اللفظي</span>
        <p className="text-ink-600 text-[13px] tabular-nums">
          السؤال {formatNumber(CURRENT_QUESTION)} من {formatNumber(TOTAL_QUESTIONS)}
        </p>
      </div>

      {/*
       * A ruler, not a metric. Twenty-four ticks because the sample section has
       * twenty-four questions; the filled ones simply mark where the specimen
       * page sits in its own section.
       */}
      <div className="mt-4 flex gap-[3px]">
        {Array.from({ length: TOTAL_QUESTIONS }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 flex-1',
              index < CURRENT_QUESTION ? 'bg-brand-500' : 'bg-line-200',
            )}
          />
        ))}
      </div>

      <p className="text-ink-900 mt-6 text-[17px] leading-relaxed font-semibold sm:text-lg">
        قلم : كتابة
        <span className="text-ink-600 mx-2 font-normal">←</span>
        الأقرب في العلاقة:
      </p>

      <ul className="border-line-200 divide-line-200 mt-5 divide-y border-y">
        {OPTIONS.map((option) => (
          <li
            key={option.label}
            className={cn(
              'flex items-center gap-3 py-3',
              // The selected row is marked by a rule on its reading edge as well
              // as by fill and weight, so the state never rests on colour alone.
              option.selected && 'border-brand-700 bg-brand-100/60 border-s-2 ps-3',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center border',
                option.selected ? 'border-brand-700 bg-brand-700' : 'border-line-500',
              )}
            >
              {option.selected ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
            </span>
            <span
              className={cn(
                'text-[15px] sm:text-base',
                option.selected ? 'text-brand-700 font-semibold' : 'text-ink-700',
              )}
            >
              {option.label}
            </span>
          </li>
        ))}
      </ul>

      {/* The workspace's own action row, rendered inert. */}
      <div className="mt-6 flex items-center justify-end gap-2.5">
        <span
          className="border-line-200 text-ink-600 rounded-control inline-flex size-9 items-center justify-center border"
          title={COPY.exam.flagAction}
        >
          <Flag className="size-4" />
        </span>
        <span className="bg-brand-700 rounded-control inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white">
          {COPY.common.next}
          <ArrowLeft className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
