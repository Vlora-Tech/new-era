import { ACCENT, type Accent } from '@/components/marketing/accent';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The homepage's chapter landmark.
 *
 * It is the same figure `RuledHead` draws for every other public page — a
 * hairline with a short bar standing on it — with an Arabic-Indic chapter
 * number set in the margin beside the title. That repetition is the point: six
 * sections with six different internal layouts still read as chapters of one
 * document, and the reader keeps their place by the sequence rather than by the
 * shape of the band.
 *
 * The bar and the numeral carry the chapter's hue from the colour code rather
 * than a fixed brand blue. Six identical blue ticks down a long page is the
 * repetition that made this document read as one grey wall; six hues make the
 * sequence itself visible, and the hue is always redundant with the numeral, so
 * nothing is communicated by colour alone.
 *
 * `SectionHeading` in `ui/surface.tsx` is deliberately left alone: the dashboard
 * and the administration area depend on it, and this head does a different job.
 */

/** ٠١ … ٠٦ — Arabic-Indic, zero-padded against the locale's own zero. */
export const arabicIndex = (value: number): string =>
  formatNumber(value).padStart(2, formatNumber(0));

export function SectionHead({
  index,
  title,
  description,
  accent = 'blue',
  className,
}: {
  index: number;
  title: string;
  description?: string;
  accent?: Accent;
  className?: string;
}) {
  const tone = ACCENT[accent];

  return (
    <div className={cn('border-line-200 relative border-t pt-6', className)}>
      {/* The bar stands ON the rule: `-top-px` puts its top edge on the rule's. */}
      <span
        aria-hidden="true"
        className={cn('absolute start-0 -top-px block h-[3px] w-10', tone.fill)}
      />

      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-baseline">
        <div className="flex items-baseline gap-4">
          {/*
           * A chapter number, not a decoration — hidden from assistive tech,
           * which already has the heading and the document order.
           */}
          <span
            aria-hidden="true"
            className={cn('shrink-0 text-[14px] font-semibold tabular-nums', tone.ink)}
          >
            {arabicIndex(index)}
          </span>
          <h2 className="text-ink-900 text-[26px] leading-[1.3] font-semibold lg:text-[32px]">
            {title}
          </h2>
        </div>

        {description ? (
          <p className="text-ink-700 measure-ar text-[16px] leading-[1.8]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
