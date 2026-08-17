/**
 * The homepage's colour code, as class names.
 *
 * The four hues are defined and justified in `globals.css`; this module is the
 * one place that turns a hue into Tailwind classes, so a chapter head, a method
 * panel and a catalogue badge can never drift to different blues.
 *
 * The strings are written out in full and never composed (`bg-${x}-100`)
 * because Tailwind scans source text: an interpolated class name is not in the
 * output stylesheet, and the element renders with no ground at all.
 */
export const ACCENTS = ['blue', 'gold', 'teal', 'green'] as const;

export type Accent = (typeof ACCENTS)[number];

/**
 * The sequence, cycled. Chapters and steps take their hue from their own index,
 * so inserting a step re-colours the ones after it rather than leaving a gap.
 */
export const accentAt = (index: number): Accent => ACCENTS[index % ACCENTS.length];

type AccentClasses = {
  /** Text at any size: every value clears 4.5:1 on white, canvas and its soft ground. */
  ink: string;
  /** A pale ground for a panel or a chip. Carries `ink-900` and `ink-700` text only. */
  soft: string;
  /** A saturated fill for an icon tile or a dimension mark. Always with white on it. */
  fill: string;
  /** `border-color` at full strength, for a 2–3px cap rule. */
  rule: string;
  /** `border-color` at low alpha, for a hairline around a chip on a tinted field. */
  hairline: string;
};

export const ACCENT: Record<Accent, AccentClasses> = {
  blue: {
    ink: 'text-brand-700',
    soft: 'bg-brand-100',
    fill: 'bg-brand-700',
    rule: 'border-brand-700',
    hairline: 'border-brand-700/25',
  },
  gold: {
    ink: 'text-accent-gold',
    soft: 'bg-accent-gold-soft',
    fill: 'bg-accent-gold',
    rule: 'border-accent-gold',
    hairline: 'border-accent-gold/25',
  },
  teal: {
    ink: 'text-accent-teal',
    soft: 'bg-accent-teal-soft',
    fill: 'bg-accent-teal',
    rule: 'border-accent-teal',
    hairline: 'border-accent-teal/25',
  },
  green: {
    ink: 'text-accent-green',
    soft: 'bg-accent-green-soft',
    fill: 'bg-accent-green',
    rule: 'border-accent-green',
    hairline: 'border-accent-green/25',
  },
};
