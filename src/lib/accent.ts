/**
 * The product's colour code, as class names.
 *
 * The four hues are defined and justified in `globals.css`. This module is the
 * one place that turns a hue into Tailwind classes, so a marketing chapter head,
 * a catalogue badge and an administration count tile can never drift to
 * different blues.
 *
 * It lives in `lib` rather than beside the marketing components because both
 * halves of the product use it now: the homepage reads the hues as the four
 * movements of the method, and the administration area reads the same four as
 * its four subject domains — products, questions, students, orders. One code,
 * two vocabularies, and a reader who learns it on the public site already knows
 * it inside the tool.
 *
 * The strings are written out in full and never composed (`bg-${x}-100`)
 * because Tailwind scans source text: an interpolated class name is not in the
 * output stylesheet, and the element renders with no ground at all.
 */
/**
 * The four coded hues, in sequence. Coral is deliberately NOT in this list: it
 * is a celebration accent, never a domain label, so it must not be reachable by
 * `accentAt()` — a hue that can turn up in a rotation is structure, not
 * punctuation. Reach for it explicitly via `ACCENT.coral`.
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
  /**
   * The vivid solid, for icon tiles, progress fills and status dots. It carries
   * white GLYPHS — it clears the 3:1 graphics threshold, not the 4.5:1 text
   * one, so white *text* on `fill` is a contrast bug. Use `inkFill` for that.
   */
  fill: string;
  /** The dark solid, for the rare chip that must carry white text. */
  inkFill: string;
  /** `border-color` at full strength, for a 2–3px cap rule. */
  rule: string;
  /** `border-color` at low alpha, for a hairline around a chip or a tinted tile. */
  hairline: string;
};

export const ACCENT: Record<Accent | 'coral', AccentClasses> = {
  blue: {
    ink: 'text-brand-700',
    soft: 'bg-brand-100',
    fill: 'bg-brand-600',
    inkFill: 'bg-brand-700',
    rule: 'border-brand-700',
    hairline: 'border-brand-700/25',
  },
  gold: {
    ink: 'text-accent-gold',
    soft: 'bg-accent-gold-soft',
    fill: 'bg-accent-gold-fill',
    inkFill: 'bg-accent-gold',
    rule: 'border-accent-gold',
    hairline: 'border-accent-gold/25',
  },
  teal: {
    ink: 'text-accent-teal',
    soft: 'bg-accent-teal-soft',
    fill: 'bg-accent-teal-fill',
    inkFill: 'bg-accent-teal',
    rule: 'border-accent-teal',
    hairline: 'border-accent-teal/25',
  },
  green: {
    ink: 'text-accent-green',
    soft: 'bg-accent-green-soft',
    fill: 'bg-accent-green-fill',
    inkFill: 'bg-accent-green',
    rule: 'border-accent-green',
    hairline: 'border-accent-green/25',
  },
  coral: {
    ink: 'text-accent-coral',
    soft: 'bg-accent-coral-soft',
    fill: 'bg-accent-coral-fill',
    inkFill: 'bg-accent-coral',
    rule: 'border-accent-coral',
    hairline: 'border-accent-coral/25',
  },
};
