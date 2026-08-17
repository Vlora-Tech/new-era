import type { Metadata } from 'next';

import { LegalPage, LegalSection } from '@/components/marketing/legal-page';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.nav.refundPolicy };

export default function RefundPolicyPage() {
  return (
    <LegalPage title={COPY.nav.refundPolicy} updatedLabel="نسخة المستند: ٢٠٢٦-٠٨-١٧.١">
      <LegalSection heading="نطاق السياسة">
        <p>تنطبق هذه السياسة على شراء الدورات والمحاكيات، وهو شراء لمرة واحدة لكل منتج.</p>
      </LegalSection>

      <LegalSection heading="الاسترداد">
        <p>
          تُحدَّد مدة الاسترداد وشروطه من قِبل الجهة المالكة للمنصة، ولم تُعتمد بعد. عند اعتماد
          السياسة النهائية ستُنشر هنا، ويُطبَّق أثر الاسترداد الكامل بإلغاء الوصول إلى المنتج.
        </p>
      </LegalSection>

      <LegalSection heading="كيفية تقديم الطلب">
        <p>
          يُقدَّم الطلب عبر صفحة التواصل مع ذكر رقم الطلب. تُراجَع الطلبات يدويًا، ويُبلَّغ المشتري
          بالنتيجة عبر بريده المسجَّل.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
