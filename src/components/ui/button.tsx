import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Buttons.
 *
 * Only `brand-700` carries white text: it is the one blue with sufficient
 * contrast (about 6.1:1). `brand-500` is reserved for icons and accents.
 * Radii stay modest and shadows are absent by design — the brand reads as
 * structural rather than decorative, and rank is carried by fill, border and
 * position rather than by elevation.
 *
 * Three things are deliberately absent and must stay absent:
 *
 *  - `box-shadow`. A tinted glow under the primary action is the decorative
 *    move the brief rules out, and it puts brand blue on the page as light
 *    rather than as ink.
 *  - `active:translate-y-px`. It would be the only transform in the entire
 *    interface, and it is what forces a special-case `prefers-reduced-motion`
 *    rule. `:active` already changes to `bg-brand-active`, which is a stronger
 *    signal and costs nothing.
 *  - `transition-all`. It animates whatever happens to change, including
 *    layout properties at a breakpoint. The site transitions colour only.
 */
const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control',
    'text-sm font-medium transition-colors duration-150 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    'disabled:pointer-events-none disabled:opacity-55',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ),
  {
    variants: {
      variant: {
        primary: 'bg-brand-700 text-white hover:bg-brand-hover active:bg-brand-active',
        secondary:
          'border border-brand-700 bg-surface text-brand-700 hover:bg-brand-100 active:bg-brand-200',
        outline: 'border border-line-500 bg-surface text-ink-900 hover:bg-surface-muted',
        ghost: 'text-ink-700 hover:bg-surface-muted hover:text-ink-900',
        link: 'text-brand-700 underline-offset-4 hover:underline',
        danger: 'bg-error text-white hover:opacity-90',
      },
      size: {
        // 44px minimum touch target on the interactive sizes.
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        // 52px. Reserved for the two places a control is the primary object in
        // its own column rather than one control among several: the homepage
        // hero and the closing band. Not a general-purpose "bigger button".
        xl: 'h-[3.25rem] px-8 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
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
