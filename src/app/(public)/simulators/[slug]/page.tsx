import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Badge, Card, Container, ErrorState } from '@/components/ui/surface';
import { getCurrentUser } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { formatDate, formatDurationWords, formatHalalas, formatNumber } from '@/lib/format';
import { getSimulatorDetail } from '@/services/catalog/product-detail';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

const TRACK_LABELS: Record<string, string> = {
  SCIENTIFIC: 'المسار العلمي',
  THEORETICAL: 'المسار النظري',
  BOTH: 'المسارَان',
  CUSTOM: 'مسار مخصص',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const simulator = await getSimulatorDetail(slug, null);
    if (!simulator) return { title: COPY.errors.notFound };

    return {
      title: simulator.title,
      description: simulator.shortDescription,
      openGraph: {
        title: simulator.title,
        description: simulator.shortDescription,
        type: 'website',
      },
    };
  } catch {
    return { title: COPY.nav.simulators };
  }
}

export default async function SimulatorDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const viewer = await getCurrentUser().catch(() => null);

  let simulator;
  try {
    simulator = await getSimulatorDetail(slug, viewer?.id ?? null);
  } catch {
    return (
      <Container className="py-12">
        <ErrorState />
      </Container>
    );
  }

  if (!simulator) notFound();

  const version = simulator.activeVersion;

  return (
    <Container className="py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        <div className="flex flex-col gap-10">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">محاكي اختبار</Badge>
              <Badge>{TRACK_LABELS[simulator.track] ?? simulator.track}</Badge>
            </div>

            <h1 className="text-ink-900 text-3xl font-semibold sm:text-4xl">{simulator.title}</h1>
            <p className="text-ink-700 max-w-2xl text-lg leading-relaxed">
              {simulator.shortDescription}
            </p>
          </header>

          {/* Figures come from the published version; without one, none are shown. */}
          {version ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-ink-900 text-xl font-semibold">تكوين الاختبار</h2>
              <dl className="border-line-200 divide-line-200 rounded-panel grid divide-y border sm:grid-cols-2 sm:divide-y-0">
                <div className="flex items-center justify-between gap-3 p-4">
                  <dt className="text-ink-700 text-sm">عدد الأقسام</dt>
                  <dd className="text-ink-900 font-medium">{formatNumber(version.sectionCount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <dt className="text-ink-700 text-sm">إجمالي الأسئلة</dt>
                  <dd className="text-ink-900 font-medium">
                    {formatNumber(version.totalQuestions)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <dt className="text-ink-700 text-sm">المدة الإجمالية</dt>
                  <dd className="text-ink-900 font-medium">
                    {formatDurationWords(version.totalDurationSec)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <dt className="text-ink-700 text-sm">الآلة الحاسبة</dt>
                  <dd className="text-ink-900 font-medium">
                    {version.calculatorEnabled ? 'متاحة' : 'غير متاحة'}
                  </dd>
                </div>
              </dl>

              <ul className="text-ink-700 flex flex-col gap-2 text-sm">
                <li>المراجعة متاحة داخل القسم الحالي فقط.</li>
                <li>بعد الانتقال إلى القسم التالي لا يمكن العودة إلى القسم السابق.</li>
                {version.scratchpadEnabled ? <li>تتوفر مسودة إلكترونية أثناء المحاولة.</li> : null}
              </ul>

              {/* Modes are named distinctly so the two experiences are not confused. */}
              <div className="flex flex-wrap gap-2">
                {simulator.fullSimulationEnabled ? (
                  <Badge variant="brand">محاكاة كاملة</Badge>
                ) : null}
                {simulator.trainingModeEnabled ? <Badge>تدريب</Badge> : null}
              </div>
            </section>
          ) : (
            <p className="text-ink-700">لم تُنشر نسخة من هذا المحاكي بعد.</p>
          )}

          {/* Provenance, stated as a review date rather than a publication date. */}
          {version?.sourceLabel ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-ink-900 text-xl font-semibold">مرجع التكوين</h2>
              <p className="text-ink-700 text-sm leading-relaxed">
                {version.sourceLabel}
                {version.sourceRetrievedAt ? (
                  <> — تاريخ مراجعة المصدر: {formatDate(version.sourceRetrievedAt)}</>
                ) : null}
              </p>
              {version.sourceNote ? (
                <p className="text-ink-700 max-w-2xl text-sm leading-relaxed">
                  {version.sourceNote}
                </p>
              ) : null}
              {version.sourceUrl ? (
                <a
                  href={version.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 text-sm hover:underline"
                >
                  الاطلاع على المصدر الرسمي
                </a>
              ) : null}
            </section>
          ) : null}

          <section
            className="border-line-200 bg-surface-muted rounded-panel border p-5"
            aria-label="إفادة الاستقلالية"
          >
            <p className="text-ink-900 text-sm leading-relaxed">
              {version?.resultDisclaimer ?? COPY.legal.independenceDisclaimer}
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="flex flex-col gap-4 p-6">
            <p className="text-ink-900 text-2xl font-semibold">
              {formatHalalas(simulator.priceHalalas)}
            </p>
            <p className="text-ink-700 text-sm">شراء لمرة واحدة. لا اشتراك ولا تجديد تلقائي.</p>

            {simulator.hasAccess ? (
              <Button asChild size="lg">
                <Link href="/dashboard/simulators">ابدأ المحاكاة</Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href={`/checkout/start?product=${simulator.slug}`}>احصل على المحاكي</Link>
              </Button>
            )}

            <p className="text-ink-700 border-line-200 border-t pt-4 text-sm leading-relaxed">
              النتائج مؤشرات أداء تدريبية تساعدك على تحديد ما يحتاج إلى تقوية، ولا تمثل درجة رسمية.
            </p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
