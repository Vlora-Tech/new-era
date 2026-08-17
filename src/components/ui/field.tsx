import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Form primitives.
 *
 * Labels are always present and always visible: a placeholder disappears the
 * moment someone starts typing, which leaves a half-filled form unreadable.
 */
export const Label = React.forwardRef<HTMLLabelElement, React.ComponentPropsWithoutRef<'label'>>(
  function Label({ className, children, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn('text-ink-900 block text-sm font-medium', className)}
        {...props}
      >
        {children}
      </label>
    );
  },
);

const controlClasses = cn(
  'block w-full rounded-control border border-line-500 bg-surface px-3 text-ink-900',
  'placeholder:text-ink-600 transition-colors duration-150',
  'focus:border-brand-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-600',
  'aria-[invalid=true]:border-error aria-[invalid=true]:outline-error',
);

export const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClasses, 'h-11', className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<'textarea'>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn(controlClasses, 'min-h-24 py-2', className)} {...props} />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentPropsWithoutRef<'select'>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(controlClasses, 'h-11', className)} {...props}>
        {children}
      </select>
    );
  },
);

export const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'border-line-500 text-brand-700 size-5 shrink-0 rounded-[4px]',
          'focus-visible:outline-brand-500 accent-[var(--neb-brand-700)] focus-visible:outline-2',
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * Validation message.
 *
 * `role="alert"` so a screen reader announces the problem when it appears, and
 * the message carries its own icon-free text: colour alone never conveys state.
 */
export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-error mt-1.5 text-sm font-medium">
      {message}
    </p>
  );
}

export function FieldHint({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="text-ink-700 mt-1.5 text-sm">
      {children}
    </p>
  );
}

/** Label, control and message grouped with the spacing the design system uses. */
export function Field({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>;
}
