import { Container, SectionHeading } from '@/components/ui/surface';

/**
 * Shared shell for the legal documents.
 *
 * The visible notice matters: these pages carry placeholder wording until the
 * client supplies their entity details and a Saudi-qualified review. Publishing
 * plausible-looking terms that nobody has approved would be worse than
 * publishing an obvious placeholder, because it reads as settled policy.
 */
export function LegalPage({
  title,
  updatedLabel,
  children,
}: {
  title: string;
  updatedLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="py-12 lg:py-16">
      <div className="max-w-3xl">
        <SectionHeading title={title} />
        <p className="text-ink-600 mt-2 text-sm">{updatedLabel}</p>

        <div
          role="note"
          className="rounded-panel border-warning/30 bg-warning-soft text-ink-900 mt-6 border p-4 text-sm leading-relaxed"
        >
          <strong className="font-semibold">هذه صيغة أولية غير نهائية.</strong> لم تُعتمد بعد من
          مستشار قانوني مختص، وستُستكمل ببيانات الجهة المالكة للمنصة قبل الإطلاق. لا يجوز الاعتماد
          عليها بصيغتها الحالية.
        </div>

        <div className="text-ink-700 mt-8 flex flex-col gap-6 leading-relaxed">{children}</div>
      </div>
    </Container>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-ink-900 text-lg font-semibold">{heading}</h2>
      {children}
    </section>
  );
}
