import type { Metadata } from 'next';
import { Mail, MessageCircle, Phone } from 'lucide-react';

import { ContactForm } from '@/components/marketing/contact-form';
import { Container } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { getSetting } from '@/repositories/site-setting-repository';

export const metadata: Metadata = { title: COPY.nav.contact };
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  let email: string | null = null;
  let phone: string | null = null;

  try {
    [email, phone] = await Promise.all([
      getSetting<string>('contact.email'),
      getSetting<string>('contact.phone'),
    ]);
  } catch {
    email = null;
    phone = null;
  }

  return (
    <main className="overflow-hidden">
      <section className="bg-canvas-blue border-line-200 relative border-b">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-45" />
        <Container className="relative py-14 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-brand-700 inline-flex items-center gap-2 text-sm font-semibold">
              <MessageCircle className="size-4" aria-hidden="true" />
              {COPY.contact.eyebrow}
            </p>
            <h1 className="text-ink-900 text-h1 mt-4">{COPY.contact.title}</h1>
            <p className="text-ink-700 text-lead mt-5 max-w-2xl">{COPY.contact.description}</p>
          </div>
        </Container>
      </section>

      <Container className="py-10 lg:py-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
          <section className="rounded-card border-line-200 bg-surface shadow-card-lg overflow-hidden border">
            <ContactForm />
          </section>

          <aside className="rounded-card border-line-200 bg-surface shadow-card border p-6 lg:sticky lg:top-28">
            <h2 className="text-ink-900 text-h3">{COPY.contact.directTitle}</h2>
            <p className="text-ink-700 mt-2 text-sm leading-relaxed">
              {COPY.contact.directDescription}
            </p>

            <div className="mt-6 flex flex-col gap-5">
              <div className="flex items-start gap-3">
                <span className="bg-brand-100 text-brand-700 rounded-control flex size-10 shrink-0 items-center justify-center">
                  <Mail className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-ink-600 text-xs font-medium">{COPY.auth.email}</p>
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      className="text-brand-700 mt-1 block font-medium break-all"
                    >
                      <bdi dir="ltr">{email}</bdi>
                    </a>
                  ) : (
                    <p className="text-ink-600 mt-1 text-sm">{COPY.contact.unavailable}</p>
                  )}
                </div>
              </div>

              <div className="border-line-200 flex items-start gap-3 border-t pt-5">
                <span className="bg-accent-teal-soft text-accent-teal rounded-control flex size-10 shrink-0 items-center justify-center">
                  <Phone className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-ink-600 text-xs font-medium">{COPY.auth.phone}</p>
                  {phone ? (
                    <a href={`tel:${phone}`} className="text-ink-900 mt-1 block font-medium">
                      <bdi dir="ltr">{phone}</bdi>
                    </a>
                  ) : (
                    <p className="text-ink-600 mt-1 text-sm">{COPY.contact.unavailable}</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  );
}
