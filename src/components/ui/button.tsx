import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Buttons — the 2026 identity's control recipe (docs/design-system.md).
 *
 * Only `brand-700` carries white text: it is the one blue with sufficient
 * contrast (about 6.1:1). `brand-500` is reserved for icons and accents.
 * Buttons are exempt from the colour code: every action stays brand blue
 * whatever the hue of the block around it.
 *
 * Elevation is one quiet, navy-tinted step (`shadow-xs`, `shadow-card` on
 * hover for the primary action) — depth as atmosphere, never glow. The only
 * transform is `active:translate-y-px`, a 1px press that the global
 * reduced-motion rule already collapses. Transitions cover colour and shadow
 * only, never layout.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control',
    // Transform joins the transition list for the press: 2% down on `:active`
    // is the feedback that makes a control feel physical. The global
    // reduced-motion rule collapses it, so it needs no special case.
    'text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    'disabled:pointer-events-none disabled:opacity-55',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ),
  {
    variants: {
      variant: {
        primary:
          'bg-brand-700 text-white shadow-xs hover:bg-brand-hover hover:shadow-card active:translate-y-px active:bg-brand-active active:shadow-xs',
        secondary:
          'border border-brand-700 bg-surface text-brand-700 shadow-xs hover:bg-brand-50 active:bg-brand-100',
        outline:
          'border border-line-200 bg-surface text-ink-900 shadow-xs hover:border-line-500 hover:bg-surface-muted',
        ghost: 'text-ink-700 hover:bg-surface-muted hover:text-ink-900',
        link: 'text-brand-700 underline-offset-4 hover:underline',
        danger: 'bg-error text-white shadow-xs hover:opacity-90 active:translate-y-px',
        /*
         * Marketing only — the landing page's primary pill. It is the single
         * exception to "every control is brand blue": see docs/design-system.md
         * § Marketing surface. Do not reach for it on a signed-in screen.
         *
         * The gradient runs brand-500 → teal-fill, and white text clears 4.5:1
         * against both ends. Hover deepens the shadow rather than the fill,
         * because darkening a two-stop gradient on hover reads as a colour
         * change rather than a state change.
         */
        gradient: 'bg-gradient-brand text-white shadow-cta hover:shadow-glow active:translate-y-px',
        /*
         * Marketing only — the canvas's black pill.
         *
         * It is the header's "ابدأ الآن" and the resume control inside the
         * drawn dashboard, and it exists because the bar already sits under a
         * blue field: a blue button on blue weather is the one place the
         * gradient pill stops reading as the primary action. Hover returns it
         * to brand blue, so the colour code still ends at the brand.
         *
         * Like `gradient`, it does not belong on a signed-in surface.
         */
        ink: 'bg-ink-900 text-white shadow-xs hover:bg-brand-700 hover:shadow-card active:translate-y-px',
        /*
         * Inside a cover frame, and nowhere else.
         *
         * The product page's masthead is a cover plate, so the one control on
         * it sits over navy: `primary` would be brand blue on blue, and `ink`
         * would be black on near-black. White is the only ground with a
         * contrast to spend there, and the ink is the field's own
         * `cover-900` — 18.6:1 on white. Hover goes to `brand-100`, which is
         * the canvas's own #dcedff to within a shade, so the control still
         * resolves towards the brand rather than towards grey.
         *
         * The exemption is the frame, not the page: this variant is illegal on
         * any surface that is not a cover.
         */
        cover:
          'bg-white text-cover-900 shadow-card hover:bg-brand-100 active:translate-y-px active:shadow-xs',
      },
      /*
       * Radius is a separate axis from variant: the marketing pill and the app's
       * 10px control are the same button in two shapes, and folding the radius
       * into `variant` would mean a `gradient` and a `gradient-square`.
       */
      shape: {
        control: 'rounded-control',
        pill: 'rounded-full',
      },
      size: {
        // 44px minimum touch target on the interactive sizes.
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        // 52px. Reserved for the places a control is the primary object in its
        // own column rather than one control among several — today the closing
        // band. Not a general-purpose "bigger button".
        xl: 'h-[3.25rem] px-8 text-base',
        /*
         * The homepage hero's pill, and nowhere else on the site.
         *
         * It is deliberately outside the height scale: the canvas sets it at
         * 24px/76px padding around 22px type, which lands near 76px tall, and
         * it is the only control on the site sized as a piece of the
         * composition rather than as a control. `h-auto` rather than a fixed
         * height so it grows with the type if the family is ever changed.
         */
        hero: 'h-auto px-10 py-5 text-lg font-bold sm:px-[76px] sm:py-6 sm:text-[22px]',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', shape: 'control' },
  },
);

export type ButtonProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      // Announce the pending state instead of only showing a spinner.
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {children}
        </>
      ) : (
        children
      )}
    </Component>
  );
});

export { buttonVariants };
