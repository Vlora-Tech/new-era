'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { COPY } from '@/lib/copy';
import {
  contactMessageSchema,
  type ContactMessageFormValues,
  type ContactMessageInput,
} from '@/validators/contact';

type ApiResponse = {
  ok: boolean;
  error?: { message?: string; details?: Record<string, string> };
};

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactMessageFormValues, unknown, ContactMessageInput>({
    resolver: zodResolver(contactMessageSchema),
    defaultValues: { name: '', email: '', subject: '', message: '', website: '' },
  });

  const submit = handleSubmit(async (values) => {
    let result: ApiResponse;
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      result = (await response.json()) as ApiResponse;
    } catch {
      toast.error(COPY.contact.form.failed);
      return;
    }

    if (!result.ok) {
      if (result.error?.details) {
        for (const [field, message] of Object.entries(result.error.details)) {
          if (field in values) setError(field as keyof ContactMessageFormValues, { message });
        }
      }
      toast.error(result.error?.message ?? COPY.contact.form.failed);
      return;
    }

    reset();
    setSent(true);
  });

  if (sent) {
    return (
      <div className="flex min-h-[28rem] flex-col items-center justify-center px-6 py-12 text-center">
        <span className="bg-success-soft text-success flex size-14 items-center justify-center rounded-full">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <h2 className="text-ink-900 text-h2 mt-5">{COPY.contact.form.successTitle}</h2>
        <p className="text-ink-700 mt-3 max-w-md leading-relaxed">
          {COPY.contact.form.successBody}
        </p>
        <Button type="button" variant="secondary" className="mt-7" onClick={() => setSent(false)}>
          {COPY.contact.form.sendAnother}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-7 lg:p-8">
      <div>
        <h2 className="text-ink-900 text-h2">{COPY.contact.form.title}</h2>
        <p className="text-ink-700 mt-2 max-w-lg text-sm leading-relaxed">
          {COPY.contact.form.description}
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 flex flex-col gap-5" noValidate>
        <div className="hidden" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="contact-name">{COPY.contact.form.name.label}</Label>
            <Input
              id="contact-name"
              autoComplete="name"
              placeholder={COPY.contact.form.name.placeholder}
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
            />
            <FieldError message={errors.name?.message} />
          </Field>

          <Field>
            <Label htmlFor="contact-email">{COPY.contact.form.email.label}</Label>
            <Input
              id="contact-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder={COPY.contact.form.email.placeholder}
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </Field>
        </div>

        <Field>
          <Label htmlFor="contact-subject">
            {COPY.contact.form.subject.label}{' '}
            <span className="text-ink-600 font-normal">({COPY.common.optional})</span>
          </Label>
          <Input
            id="contact-subject"
            placeholder={COPY.contact.form.subject.placeholder}
            aria-invalid={Boolean(errors.subject)}
            {...register('subject')}
          />
          <FieldError message={errors.subject?.message} />
        </Field>

        <Field>
          <Label htmlFor="contact-message">{COPY.contact.form.message.label}</Label>
          <Textarea
            id="contact-message"
            rows={7}
            placeholder={COPY.contact.form.message.placeholder}
            aria-invalid={Boolean(errors.message)}
            {...register('message')}
          />
          <FieldError message={errors.message?.message} />
        </Field>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-600 max-w-md text-xs leading-relaxed">
            {COPY.contact.responseNote}
          </p>
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full sm:w-auto">
            <Send className="size-4" aria-hidden="true" />
            {isSubmitting ? COPY.contact.form.submitting : COPY.contact.form.submit}
          </Button>
        </div>
      </form>
    </div>
  );
}
