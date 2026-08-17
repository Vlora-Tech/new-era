import type { Metadata } from 'next';

import { LegalPage, LegalSection } from '@/components/marketing/legal-page';
import { COPY } from '@/lib/copy';

export const metadata: Metadata = { title: COPY.nav.privacy };

export default function PrivacyPage() {
  return (
    <LegalPage title={COPY.nav.privacy} updatedLabel="نسخة المستند: ٢٠٢٦-٠٨-١٧.١">
      <LegalSection heading="البيانات التي نجمعها">
        <p>
          الاسم والبريد الإلكتروني ورقم الجوال (اختياري)، إضافة إلى بيانات الاستخدام اللازمة لتشغيل
          الخدمة مثل تقدّمك في الدروس ومحاولاتك في المحاكيات.
        </p>
      </LegalSection>

      <LegalSection heading="بيانات الدفع">
        <p>
          تُعالَج بيانات البطاقة لدى مزوّد الدفع مباشرة، ولا تمر عبر خوادم المنصة ولا تُخزَّن لديها.
          نحتفظ بمرجع العملية ومبلغها وحالتها فقط.
        </p>
      </LegalSection>

      <LegalSection heading="مراجعة قانونية مطلوبة قبل الإطلاق">
        <p>
          لأن الفئة المستهدفة تشمل طلبة المرحلة الثانوية وقد يكون بعضهم قاصرًا، فإن تحديد الأساس
          النظامي للمعالجة، ومتطلبات موافقة ولي الأمر، ومدد الاحتفاظ والحذف، ومواقع مقدّمي الخدمة
          ونقل البيانات خارج المملكة — كل ذلك يتطلب مراجعة من مستشار مختص بنظام حماية البيانات
          الشخصية قبل تشغيل المنصة فعليًا. لم تُستكمل هذه المراجعة بعد.
        </p>
      </LegalSection>

      <LegalSection heading="حقوقك">
        <p>
          لك حق الوصول إلى بياناتك وتصحيحها وطلب حذفها، وفق ما ينظّمه النظام المعمول به. تُحدَّد
          آلية تقديم الطلب بعد استكمال المراجعة أعلاه.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
