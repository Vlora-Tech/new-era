import Link from 'next/link';
import { BookOpen, ClipboardList, GraduationCap, Target } from 'lucide-react';

import { StudyArtifact } from '@/components/marketing/study-artifact';
import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  Container,
  EmptyState,
  ErrorState,
  SectionHeading,
} from '@/components/ui/surface';
import { COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatHalalas } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PATH_ICONS = [BookOpen, Target, ClipboardList, GraduationCap] as const;

const FAQ = [
  {
    question: 'هل الشراء لمرة واحدة أم اشتراك متكرر؟',
    answer:
      'الشراء لمرة واحدة لكل دورة أو محاكٍ. لا توجد اشتراكات شهرية ولا تجديد تلقائي، ويبقى ما اشتريته متاحًا في حسابك.',
  },
  {
    question: 'متى يُفتح المحتوى بعد الدفع؟',
    answer:
      'يُفتح مباشرة بعد تأكيد عملية الدفع لدى مزوّد الدفع، ويظهر المنتج في لوحتك دون خطوات إضافية.',
  },
  {
    question: 'كيف تعمل مقاطع الدروس؟',
    answer:
      'المقاطع محمية ومرتبطة بحسابك، ويحفظ الموضع الذي توقفت عنده تلقائيًا لتكمل من حيث انتهيت.',
  },
  {
    question: 'ما الفرق بين المحاكاة الكاملة والتدريب؟',
    answer:
      'المحاكاة الكاملة تلتزم بأقسام وتوقيت وقواعد انتقال ثابتة. أما التدريب فيتيح اختيار المهارة ومستوى الصعوبة وعرض الشرح فور الإجابة.',
  },
  {
    question: 'هل نتائج المحاكي درجة رسمية؟',
    answer:
      'لا. النتائج مؤشرات أداء تدريبية تساعدك على معرفة ما يحتاج إلى تقوية، ولا تمثل درجة رسمية ولا تنبؤًا بها.',
  },
  {
    question: 'هل الأسئلة منقولة من اختبارات سابقة؟',
    answer:
      'لا. جميع الأسئلة من إعداد المنصة، وتحاكي المهارات والأنماط المعلنة رسميًا دون نقل أي محتوى محمي.',
  },
] as const;

type FeaturedProduct = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  priceHalalas: number;
  type: 'COURSE' | 'EXAM_SIMULATOR';
};

async function loadFeaturedProducts(): Promise<
  { ok: true; products: FeaturedProduct[] } | { ok: false }
> {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
      take: 4,
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        priceHalalas: true,
        type: true,
      },
    });
    return { ok: true, products };
  } catch {
    // An outage must not render as "no products yet": that would read as a
    // true fact about the catalogue rather than a failure to load it.
    return { ok: false };
  }
}

export default async function HomePage() {
  const featured = await loadFeaturedProducts();

  return (
    <>
      {/* Hero: copy leads on the right, the study artifact sits on the left. */}
      <section className="border-line-200 bg-surface border-b">
        <Container className="py-14 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <p className="text-brand-700 text-sm font-medium">{COPY.home.eyebrow}</p>
              <h1 className="text-ink-900 text-4xl leading-tight font-semibold sm:text-5xl">
                {COPY.home.heading}
              </h1>
              <p className="text-ink-700 max-w-xl text-lg leading-relaxed">
                {COPY.home.supporting}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/register">{COPY.home.primaryAction}</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/courses">{COPY.home.secondaryAction}</Link>
                </Button>
              </div>

              <p className="text-ink-600 text-sm">{COPY.home.learningLine}</p>
            </div>

            {/* On mobile the copy comes first and this becomes a compact preview. */}
            <StudyArtifact className="order-last" />
          </div>
        </Container>
      </section>

      {/* Learning path */}
      <section className="border-line-200 border-b">
        <Container className="py-14 lg:py-20">
          <SectionHeading title={COPY.home.pathTitle} />
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {COPY.home.pathSteps.map((step, index) => {
              const Icon = PATH_ICONS[index] ?? BookOpen;
              return (
                <li key={step.title} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className="text-brand-500 size-6" aria-hidden="true" />
                    <h3 className="text-ink-900 text-lg font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-ink-700">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* Two product paths */}
      <section className="border-line-200 bg-surface border-b">
        <Container className="py-14 lg:py-20">
          <SectionHeading title={COPY.home.productsTitle} />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card className="flex flex-col gap-4 p-6">
              <BookOpen className="text-brand-500 size-7" aria-hidden="true" />
              <h3 className="text-ink-900 text-xl font-semibold">{COPY.home.coursesTitle}</h3>
              <p className="text-ink-700">{COPY.home.coursesBody}</p>
              <Button asChild variant="secondary" className="mt-2 self-start">
                <Link href="/courses">{COPY.nav.courses}</Link>
              </Button>
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <ClipboardList className="text-brand-500 size-7" aria-hidden="true" />
              <h3 className="text-ink-900 text-xl font-semibold">{COPY.home.simulatorsTitle}</h3>
              <p className="text-ink-700">{COPY.home.simulatorsBody}</p>
              <Button asChild variant="secondary" className="mt-2 self-start">
                <Link href="/simulators">{COPY.nav.simulators}</Link>
              </Button>
            </Card>
          </div>
        </Container>
      </section>

      {/* Real catalogue content, or an honest statement of its absence */}
      <section className="border-line-200 border-b">
        <Container className="py-14 lg:py-20">
          <SectionHeading title={COPY.home.featuredTitle} />
          <div className="mt-8">
            {!featured.ok ? (
              <ErrorState />
            ) : featured.products.length === 0 ? (
              <EmptyState title={COPY.home.featuredEmpty} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {featured.products.map((product) => (
                  <li key={product.id}>
                    <Card className="flex h-full flex-col gap-3 p-6">
                      <Badge variant="brand">
                        {product.type === 'COURSE' ? 'دورة' : 'محاكي اختبار'}
                      </Badge>
                      <h3 className="text-ink-900 text-lg font-semibold">{product.title}</h3>
                      <p className="text-ink-700 flex-1 text-sm">{product.shortDescription}</p>
                      <div className="border-line-200 flex items-center justify-between gap-3 border-t pt-4">
                        <span className="text-ink-900 font-medium">
                          {formatHalalas(product.priceHalalas)}
                        </span>
                        <Button asChild variant="secondary" size="sm">
                          <Link
                            href={`${product.type === 'COURSE' ? '/courses' : '/simulators'}/${product.slug}`}
                          >
                            التفاصيل
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </section>

      {/* How buying and learning works */}
      <section id="how-it-works" className="border-line-200 bg-surface scroll-mt-20 border-b">
        <Container className="py-14 lg:py-20">
          <SectionHeading title={COPY.home.howTitle} />
          <ol className="divide-line-200 mt-8 flex flex-col divide-y">
            {COPY.home.howSteps.map((step, index) => (
              <li key={step.title} className="flex gap-5 py-6 first:pt-0 last:pb-0">
                <span
                  className="bg-brand-100 text-brand-700 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  aria-hidden="true"
                >
                  {new Intl.NumberFormat('ar-SA').format(index + 1)}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-ink-900 text-lg font-semibold">{step.title}</h3>
                  <p className="text-ink-700">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Why the method works — described without guarantees or invented metrics */}
      <section className="border-line-200 border-b">
        <Container className="py-14 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <SectionHeading title={COPY.home.whyTitle} description={COPY.home.safeExamClaim} />
            <ul className="flex flex-col gap-5">
              <li className="flex flex-col gap-1.5">
                <h3 className="text-ink-900 font-semibold">تدريب على النمط لا على السؤال</h3>
                <p className="text-ink-700">
                  الأسئلة مصنّفة حسب المهارة والمهارة الفرعية، فتتدرّب على طريقة التفكير التي يتكرر
                  استخدامها بدل حفظ إجابات بعينها.
                </p>
              </li>
              <li className="flex flex-col gap-1.5">
                <h3 className="text-ink-900 font-semibold">ظروف قريبة من يوم الاختبار</h3>
                <p className="text-ink-700">
                  أقسام موقوتة، وانتقال لا رجعة فيه بين الأقسام، وحفظ تلقائي للإجابات — حتى تكون
                  التجربة مألوفة قبل أن تخوضها فعليًا.
                </p>
              </li>
              <li className="flex flex-col gap-1.5">
                <h3 className="text-ink-900 font-semibold">مراجعة تدلّك على ما يحتاج إلى تقوية</h3>
                <p className="text-ink-700">
                  بعد كل محاولة ترى دقتك في كل مهارة والزمن الذي استغرقته، فتعرف أين تضع جهدك في
                  المرة القادمة.
                </p>
              </li>
            </ul>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="border-line-200 bg-surface border-b">
        <Container className="py-14 lg:py-20">
          <SectionHeading title={COPY.home.faqTitle} />
          <dl className="divide-line-200 mt-8 flex flex-col divide-y">
            {FAQ.map((item) => (
              <div key={item.question} className="flex flex-col gap-2 py-6 first:pt-0 last:pb-0">
                <dt className="text-ink-900 text-lg font-semibold">{item.question}</dt>
                <dd className="text-ink-700 max-w-3xl leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Standing independence statement */}
      <section>
        <Container className="py-10">
          <p className="text-ink-700 max-w-3xl text-sm leading-relaxed">
            {INDEPENDENCE_DISCLAIMER}
          </p>
        </Container>
      </section>
    </>
  );
}
