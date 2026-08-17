import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';

/**
 * The homepage hero visual.
 *
 * This is an editorial illustration built from the product's own interface
 * primitives: a practice question the way it actually appears, on a paper-like
 * surface. Deliberately not a floating analytics dashboard, not a device mockup,
 * and not a screenshot of any official test interface.
 *
 * The question shown is an original sample authored for the platform. The
 * progress strip is a static, unlabelled rhythm indicator — it reports no
 * statistic, because inventing one would be fabricating evidence of use.
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
      className={cn('rounded-panel border-line-200 bg-surface border p-5 sm:p-7', className)}
      // Decorative: the same content is stated in the surrounding copy, and a
      // screen reader gains nothing from walking a sample question here.
      aria-hidden="true"
    >
      <div className="border-line-200 flex items-center justify-between gap-4 border-b pb-4">
        <p className="text-ink-700 text-sm font-medium">التناظر اللفظي</p>
        <p className="text-ink-600 text-sm">
          السؤال {formatNumber(CURRENT_QUESTION)} من {formatNumber(TOTAL_QUESTIONS)}
        </p>
      </div>

      {/* A quiet rhythm strip, not a metric: no number is claimed. */}
      <div className="mt-4 flex gap-1" aria-hidden="true">
        {Array.from({ length: TOTAL_QUESTIONS }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full',
              index < CURRENT_QUESTION ? 'bg-brand-500' : 'bg-surface-muted',
            )}
          />
        ))}
      </div>

      <p className="text-ink-900 mt-7 text-lg leading-relaxed font-medium">
        قلم : كتابة
        <span className="text-ink-600 mx-2">←</span>
        الأقرب في العلاقة:
      </p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {OPTIONS.map((option) => (
          <li
            key={option.label}
            className={cn(
              'rounded-control flex items-center justify-between gap-3 border px-4 py-3',
              option.selected ? 'border-brand-700 bg-brand-100' : 'border-line-200 bg-surface',
            )}
          >
            <span
              className={cn(
                'text-base',
                option.selected ? 'text-brand-700 font-medium' : 'text-ink-700',
              )}
            >
              {option.label}
            </span>
            {option.selected ? (
              <Check className="text-brand-700 size-4 shrink-0" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ul>

      <p className="border-line-200 text-ink-700 mt-6 border-t pt-4 text-sm leading-relaxed">
        العلاقة بين الكلمتين هي أداة ووظيفتها؛ ابحث عن الزوج الذي تربطه العلاقة نفسها بالترتيب ذاته.
      </p>
    </div>
  );
}
