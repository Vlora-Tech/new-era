import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Badge,
  Card,
  Container,
  ErrorState,
  Notice,
  RuledHead,
  Subhead,
} from '@/components/ui/surface';
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

  // Read straight from the published version. Without one, no figure is shown —
  // an unpublished configuration must never render as a set of zeroes.
  const configuration = version
    ? [
        { label: 'عدد الأقسام', value: formatNumber(version.sectionCount) },
        { label: 'إجمالي الأسئلة', value: formatNumber(version.totalQuestions) },
        { label: 'المدة الإجمالية', value: formatDurationWords(version.totalDurationSec) },
        { label: 'الآلة الحاسبة', value: version.calculatorEnabled ? 'متاحة' : 'غير متاحة' },
      ]
    : [];

  return (
    <Container className="py-10 lg:py-16">
      <div className="grid gap-y-14 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-x-16">
        <div>
          <RuledHead>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" shape="square">
                {COPY.statusLabels.productType.EXAM_SIMULATOR}
              </Badge>
              <Badge variant="outline" shape="square">
                {TRACK_LABELS[simulator.track] ?? simulator.track}
              </Badge>
            </div>

            <h1 className="text-ink-900 mt-5 text-[30px] leading-[1.28] font-semibold lg:text-[38px] lg:leading-[1.22]">
              {simulator.title}
            </h1>

            <p className="text-ink-700 measure-ar-lg mt-5 text-[17px] leading-[1.85] lg:text-[18px]">
              {simulator.shortDescription}
            </p>
          </RuledHead>

          <section className="mt-14">
            <Subhead title="تكوين الاختبار" />

            {version ? (
              <>
                {/*
                 * Bounded to the reading measure. At full column width the
                 * `justify-between` row put ~780px of white between a label and
                 * its own value, which reads as two unrelated columns rather
                 * than as one specification.
                 */}
                <dl className="border-line-200 divide-line-200 measure-ar-lg mt-6 divide-y border-y">
                  {configuration.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 py-3.5"
                    >
                      <dt className="text-ink-700 text-sm">{row.label}</dt>
                      <dd className="text-ink-900 font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="text-ink-700 measure-ar-lg mt-6 flex flex-col gap-2 text-sm leading-[1.8]">
                  <li>المراجعة متاحة داخل القسم الحالي فقط.</li>
                  <li>بعد الانتقال إلى القسم التالي لا يمكن العودة إلى القسم السابق.</li>
                  {version.scratchpadEnabled ? (
                    <li>تتوفر مسودة إلكترونية أثناء المحاولة.</li>
                  ) : null}
                </ul>

                {/* Modes are named distinctly so the two experiences are not confused. */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {simulator.fullSimulationEnabled ? (
                    <Badge variant="brand">محاكاة كاملة</Badge>
                  ) : null}
                  {simulator.trainingModeEnabled ? <Badge>تدريب</Badge> : null}
                </div>
              </>
            ) : (
              <p className="text-ink-700 mt-5">لم تُنشر نسخة من هذا المحاكي بعد.</p>
            )}
          </section>

          {/* Provenance, stated as a review date rather than a publication date. */}
          {version?.sourceLabel ? (
            <section className="mt-14">
              <Subhead title="مرجع التكوين" />
              <p className="text-ink-700 measure-ar-lg mt-5 text-sm leading-[1.9]">
                {version.sourceLabel}
                {version.sourceRetrievedAt ? (
                  <> — تاريخ مراجعة المصدر: {formatDate(version.sourceRetrievedAt)}</>
                ) : null}
              </p>
              {version.sourceNote ? (
                <p className="text-ink-700 measure-ar-lg mt-3 text-sm leading-[1.9]">
                  {version.sourceNote}
                </p>
              ) : null}
              {version.sourceUrl ? (
                <a
                  href={version.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 mt-4 inline-flex text-sm font-medium hover:underline"
                >
                  الاطلاع على المصدر الرسمي
                </a>
              ) : null}
            </section>
          ) : null}

          {/*
           * The independence statement. A standing fact, so `role="note"` rather
           * than an alert — nothing here has gone wrong.
           */}
          <Notice tone="neutral" role="note" label="إفادة الاستقلالية" className="mt-14">
            {version?.resultDisclaimer ?? COPY.legal.independenceDisclaimer}
          </Notice>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <p className="text-ink-900 text-[28px] leading-none font-semibold">
              {formatHalalas(simulator.priceHalalas)}
            </p>
            <p className="text-ink-700 mt-3 text-sm leading-[1.8]">
              شراء لمرة واحدة. لا اشتراك ولا تجديد تلقائي.
            </p>

            {simulator.hasAccess ? (
              <Button asChild size="lg" className="mt-6 w-full">
                <Link href="/dashboard/simulators">ابدأ المحاكاة</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="mt-6 w-full">
                <Link href={`/checkout/start?product=${simulator.slug}`}>احصل على المحاكي</Link>
              </Button>
            )}

            <p className="text-ink-700 border-line-200 mt-6 border-t pt-5 text-sm leading-[1.85]">
              النتائج مؤشرات أداء تدريبية تساعدك على تحديد ما يحتاج إلى تقوية، ولا تمثل درجة رسمية.
            </p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
