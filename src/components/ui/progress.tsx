import { cn } from '@/lib/utils';

/**
 * Progress primitives.
 *
 * Both are `aria-hidden` by contract: a bar or a ring is a picture of a number
 * that is always stated in words beside it, and announcing it twice is how a
 * screen-reader user hears "٦٠٪ ٦٠٪". The caller owns the accessible value —
 * these draw it.
 *
 * Both clamp their input. A percentage arriving as 140 from a rounding error
 * must not paint a bar past its track or a ring past its circumference.
 */
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function ProgressBar({
  value,
  tone = 'bg-brand-600',
  track = 'bg-surface-muted',
  className,
}: {
  /** 0–100. Clamped. */
  value: number;
  /** A `fill` class from the colour code. */
  tone?: string;
  track?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-2 w-full overflow-hidden rounded-full', track, className)}
    >
      {/*
       * `inline-size` rather than `width`: under dir="rtl" the fill has to grow
       * from the right edge, which the logical property does for free.
       */}
      <div
        className={cn('h-full rounded-full transition-[inline-size] duration-500', tone)}
        style={{ inlineSize: `${clamp(value)}%` }}
      />
    </div>
  );
}

/**
 * A ring for a single headline figure. The stroke is drawn from the top and
 * clockwise regardless of document direction — a clock does not mirror.
 */
export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  className,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** The figure itself, centred inside the ring. */
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamp(value) / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ inlineSize: size, blockSize: size }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="stroke-current transition-[stroke-dasharray] duration-500"
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 grid place-items-center">{children}</span>
      ) : null}
    </div>
  );
}
