'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';
import { cn } from '@/lib/utils';

export function AdminEditorDialog({
  title,
  description,
  size = 'md',
  onClose,
  children,
}: {
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink-900/45 fixed inset-0 z-[60] backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'bg-surface shadow-overlay fixed z-[70] flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden border border-white/70',
            'rounded-card inset-x-2 bottom-2 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100vw-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2',
            size === 'sm' && 'sm:max-w-lg',
            size === 'md' && 'sm:max-w-2xl',
            size === 'lg' && 'sm:max-w-4xl',
          )}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <header className="border-line-200/80 bg-surface/95 flex shrink-0 items-start gap-4 border-b px-5 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-ink-900 font-display text-[21px] leading-[1.5] font-bold">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-ink-700 mt-1 max-w-prose text-sm leading-[1.75]">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-me-2 -mt-1 shrink-0"
                aria-label={COPY.common.close}
                title={COPY.common.close}
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
