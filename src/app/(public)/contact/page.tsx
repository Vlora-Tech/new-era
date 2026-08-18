import type { Metadata } from 'next';
import { Mail, Phone } from 'lucide-react';

import { Card, Container, SectionHeading } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { getSetting } from '@/repositories/site-setting-repository';

export const metadata: Metadata = { title: COPY.nav.contact };
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  // Contact details are configuration, not hardcoded marketing copy, so the
  // client can correct them without a deployment.
  let email: string | null = null;
  let phone: string | null = null;

  try {
    email = await getSetting<string>('contact.email');
    phone = await getSetting<string>('contact.phone');
  } catch {
    email = null;
    phone = null;
  }

  return (
    <Container className="py-12 lg:py-16">
      <div className="max-w-2xl">
        <SectionHeading
          title={COPY.nav.contact}
          description="للاستفسارات المتعلقة بالحساب أو الطلبات أو المحتوى."
        />

        <Card className="mt-8 flex flex-col gap-5 p-6">
          <div className="flex items-center gap-4">
            {/* The tile is decoration; the channel is named by the label. */}
            <span
              aria-hidden="true"
              className="bg-brand-100 text-brand-700 rounded-control flex size-10 shrink-0 items-center justify-center"
            >
              <Mail className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-ink-900 text-sm font-medium">{COPY.auth.email}</span>
              {email ? (
                <a href={`mailto:${email}`} className="text-brand-700 hover:underline">
                  <bdi dir="ltr">{email}</bdi>
                </a>
              ) : (
                <span className="text-ink-600">لم تُضبط بعد.</span>
              )}
            </div>
          </div>

          <div className="border-line-200 flex items-center gap-4 border-t pt-5">
            <span
              aria-hidden="true"
              className="bg-brand-100 text-brand-700 rounded-control flex size-10 shrink-0 items-center justify-center"
            >
              <Phone className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-ink-900 text-sm font-medium">{COPY.auth.phone}</span>
              {phone ? (
                <bdi dir="ltr" className="text-ink-700">
                  {phone}
                </bdi>
              ) : (
                <span className="text-ink-600">لم يُضبط بعد.</span>
              )}
            </div>
          </div>
        </Card>

        <p className="text-ink-700 mt-6 text-sm">
          ستُستكمل بيانات الجهة المالكة والسجل التجاري قبل إطلاق المنصة.
        </p>
      </div>
    </Container>
  );
}
