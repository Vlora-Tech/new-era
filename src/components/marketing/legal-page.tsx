import { Container, Notice, PageHead, Subhead } from '@/components/ui/surface';

/**
 * Shared shell for the legal documents.
 *
 * Set as a document, not as a marketing page: one measure, ruled sections, and
 * a numbered-feeling rhythm — the same ruled head the catalogue and the homepage
 * use, dropped to section scale.
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
    <Container className="py-10 lg:py-16">
      <div className="measure-ar-lg">
        <PageHead
          title={title}
          meta={<p className="text-ink-600 text-[13px] leading-none">{updatedLabel}</p>}
        />

        <Notice tone="warning" role="note" className="mt-10">
          <strong className="font-semibold">هذه صيغة أولية غير نهائية.</strong> لم تُعتمد بعد من
          مستشار قانوني مختص، وستُستكمل ببيانات الجهة المالكة للمنصة قبل الإطلاق. لا يجوز الاعتماد
          عليها بصيغتها الحالية.
        </Notice>

        <div className="mt-14 flex flex-col gap-10">{children}</div>
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
    <section>
      <Subhead title={heading} />
      <div className="text-ink-700 mt-4 flex flex-col gap-4 text-[16px] leading-[1.9]">
        {children}
      </div>
    </section>
  );
}
