import type { Metadata } from 'next';

import { LegalPage, LegalSection } from '@/components/marketing/legal-page';
import { COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.nav.terms };

export default function TermsPage() {
  return (
    <LegalPage title={COPY.nav.terms} updatedLabel="نسخة المستند: ٢٠٢٦-٠٨-١٧.١">
      <LegalSection heading="طبيعة الخدمة">
        <p>
          تقدّم المنصة دورات مرئية واختبارات محاكية للتدريب على اختبار القدرات العامة. الوصول إلى كل
          منتج يتم بشراء لمرة واحدة، دون اشتراكات متكررة أو تجديد تلقائي.
        </p>
        <p>{INDEPENDENCE_DISCLAIMER}</p>
      </LegalSection>

      <LegalSection heading="الحساب">
        <p>
          يلتزم المستخدم بصحة بياناته وبالحفاظ على سرية كلمة المرور. الحساب شخصي، ولا يجوز مشاركته
          أو إتاحة محتواه للغير.
        </p>
      </LegalSection>

      <LegalSection heading="المحتوى وحقوقه">
        <p>
          جميع الأسئلة والشروحات من إعداد المنصة أو مرخّصة لها، ولا يجوز نسخها أو تصويرها أو إعادة
          نشرها بأي صورة.
        </p>
      </LegalSection>

      <LegalSection heading="حدود المسؤولية">
        <p>
          المنصة أداة تدريب، ولا تضمن تحقيق درجة معينة في الاختبار الرسمي، ولا تمثل نتائجها نتيجة
          رسمية.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
