import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, FileQuestion, Package, ReceiptText, Users } from 'lucide-react';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { CountTile } from '@/components/admin/count-tile';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState } from '@/components/ui/surface';
import type { Accent } from '@/lib/accent';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { formatNumber, formatTime } from '@/lib/format';
import { logger } from '@/lib/logger';
import { listAuditLog, type AdminAuditRow } from '@/services/audit/audit-query.service';
import { auditLogQuerySchema } from '@/validators/admin-audit';

export const metadata: Metadata = { title: COPY.admin.overview };

type CountRow = {
  key: string;
  label: string;
  value: number;
  accent: Accent;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
};

/**
 * Hue and icon by subject domain, not by position: the two product counts, the
 * three question counts and the two order counts each read as one block, and
 * the icon is the same mark the navigation rail gives that section. Changing
 * the order of the list below therefore regroups the colour automatically.
 */
const PRODUCTS = { accent: 'blue', icon: Package } as const;
const QUESTIONS = { accent: 'gold', icon: FileQuestion } as const;
const STUDENTS = { accent: 'teal', icon: Users } as const;
const ORDERS = { accent: 'green', icon: ReceiptText } as const;

/**
 * The only real data on this screen: eight counts, read in one transaction so
 * they describe a single consistent moment rather than eight different ones.
 *
 * Nothing here is derived, projected or compared against a previous period. A
 * count is a fact; a trend line drawn over two of them would not be.
 */
async function loadCounts(): Promise<CountRow[]> {
  const labels = COPY.adminPages.counts;

  const [
    publishedProducts,
    draftProducts,
    students,
    publishedQuestions,
    inReviewQuestions,
    draftQuestions,
    paidOrders,
    pendingOrders,
  ] = await prisma.$transaction([
    prisma.product.count({ where: { status: 'PUBLISHED' } }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.question.count({ where: { workflow: 'PUBLISHED' } }),
    prisma.question.count({ where: { workflow: 'IN_REVIEW' } }),
    prisma.question.count({ where: { workflow: 'DRAFT' } }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
  ]);

  return [
    {
      key: 'publishedProducts',
      label: labels.publishedProducts,
      value: publishedProducts,
      ...PRODUCTS,
    },
    { key: 'draftProducts', label: labels.draftProducts, value: draftProducts, ...PRODUCTS },
    {
      key: 'publishedQuestions',
      label: labels.publishedQuestions,
      value: publishedQuestions,
      ...QUESTIONS,
    },
    {
      key: 'inReviewQuestions',
      label: labels.inReviewQuestions,
      value: inReviewQuestions,
      ...QUESTIONS,
    },
    { key: 'draftQuestions', label: labels.draftQuestions, value: draftQuestions, ...QUESTIONS },
    { key: 'students', label: labels.students, value: students, ...STUDENTS },
    { key: 'paidOrders', label: labels.paidOrders, value: paidOrders, ...ORDERS },
    { key: 'pendingOrders', label: labels.pendingOrders, value: pendingOrders, ...ORDERS },
  ];
}

// ── The work queue ───────────────────────────────────────────────────────

type AttentionRow = {
  key: string;
  label: string;
  note: string;
  value: number;
  href: string;
};

/**
 * Things waiting on a person, and where each is resolved.
 *
 * Separate from the counts above because it answers a different question. The
 * counts describe the platform; these describe an obligation, and a payment
 * held for somebody's decision must not sit in the same grid as "we have 264
 * questions". Every row therefore carries a destination — a number an
 * administrator cannot act on does not belong in a queue.
 *
 * Read in one transaction, for the same reason the counts are: four totals
 * gathered at four different moments describe a platform that never existed.
 */
async function loadAttention(): Promise<AttentionRow[]> {
  const labels = COPY.adminPages.attention;

  const [paymentsNeedReview, questionsInReview, failedWebhooks, simulatorsWithoutVersion] =
    await prisma.$transaction([
      prisma.paymentAttempt.count({ where: { needsReview: true } }),
      prisma.question.count({ where: { workflow: 'IN_REVIEW' } }),
      prisma.webhookEvent.count({ where: { status: 'FAILED' } }),
      /*
       * A simulator whose product is on sale but which has no active version is
       * the worst of these: a student can buy it and then cannot start a single
       * attempt. Draft products are excluded because an unpublished simulator
       * without a version is simply unfinished, not broken.
       */
      prisma.examSimulator.count({
        where: { activeExamVersionId: null, product: { status: 'PUBLISHED' } },
      }),
    ]);

  return [
    {
      key: 'paymentsNeedReview',
      label: labels.paymentsNeedReview,
      note: labels.paymentsNeedReviewNote,
      value: paymentsNeedReview,
      href: '/admin/orders',
    },
    {
      key: 'simulatorsWithoutVersion',
      label: labels.simulatorsWithoutVersion,
      note: labels.simulatorsWithoutVersionNote,
      value: simulatorsWithoutVersion,
      href: '/admin/simulators',
    },
    {
      key: 'questionsInReview',
      label: labels.questionsInReview,
      note: labels.questionsInReviewNote,
      value: questionsInReview,
      href: '/admin/questions?workflow=IN_REVIEW',
    },
    {
      key: 'failedWebhooks',
      label: labels.failedWebhooks,
      note: labels.failedWebhooksNote,
      value: failedWebhooks,
      href: '/admin/orders',
    },
  ];
}

export default async function AdminOverviewPage() {
  // A failed query becomes an error panel, never a row of zeros: a zero here is
  // indistinguishable from "the platform genuinely has none of these".
  let counts: CountRow[] | null = null;
  try {
    counts = await loadCounts();
  } catch (error) {
    logger.error('admin overview counts failed', { error });
  }

  /*
   * Each panel below degrades on its own. A failed audit read must not take the
   * work queue down with it — the three answer different questions, and losing
   * one is no reason to hide the other two.
   */
  let attention: AttentionRow[] | null = null;
  try {
    attention = await loadAttention();
  } catch (error) {
    logger.error('admin overview attention failed', { error });
  }

  let recent: AdminAuditRow[] | null = null;
  try {
    // The audit screen's own reader, with its default window and a short page:
    // this is a glimpse of that screen, not a second implementation of it.
    recent = (await listAuditLog(auditLogQuerySchema.parse({ perPage: 10 }))).rows.slice(0, 6);
  } catch (error) {
    logger.error('admin overview recent activity failed', { error });
  }

  const waiting = attention?.filter((row) => row.value > 0) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.admin.overview}
        description={COPY.adminPages.overviewDescription}
      />

      {counts ? (
        <Card className="p-5 sm:p-6">
          {/*
            The heading and nothing else. The sentence that used to sit here —
            "actual counts at the moment the page opened, not performance
            indicators or trends" — restated «أعداد حالية» and then denied two
            things nobody had claimed.
          */}
          <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
            {COPY.adminPages.counts.title}
          </h2>

          {/*
            `auto-fill` against a 232px floor rather than fixed breakpoints: the
            tiles are all one size, so the column count should follow the width
            available rather than three hand-picked thresholds.
          */}
          <dl className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3.5">
            {counts.map((row) => (
              <CountTile
                key={row.key}
                label={row.label}
                value={row.value}
                accent={row.accent}
                icon={row.icon}
              />
            ))}
          </dl>
        </Card>
      ) : (
        <ErrorState />
      )}

      {/*
        The queue and the trail, side by side.

        They were stacked full-width, which pushed the trail below the fold on
        every laptop and gave both panels a measure far wider than their content
        — a queue row is a count, a label and a button; an activity row is one
        line. `auto-fit` against a 340px floor puts them in one column on a
        narrow viewport without a breakpoint, and `items-start` stops the
        shorter panel stretching to match the taller one.
      */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-4">
        {/* ── What is waiting on somebody ── */}
        {attention ? (
          <Card className="p-5 sm:p-6">
            <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
              {COPY.adminPages.attention.title}
            </h2>

            {waiting.length === 0 ? (
              /*
              An empty queue is a fact worth stating plainly, not a blank space.
              `EmptyState` and not `ErrorState`: nothing failed here — there is
              genuinely nothing waiting, which is the outcome to hope for.
            */
              <div className="mt-5">
                <EmptyState
                  title={COPY.adminPages.attention.allClearTitle}
                  description={COPY.adminPages.attention.allClearBody}
                />
              </div>
            ) : (
              <ul className="mt-5 flex flex-col gap-3">
                {waiting.map((row) => (
                  <li
                    key={row.key}
                    className="rounded-panel border-line-200 bg-surface-muted flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {/* The count leads: it is the reason the row is here. */}
                      <span className="text-ink-900 font-display text-2xl font-bold tabular-nums">
                        {formatNumber(row.value)}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-ink-900 text-sm font-medium">{row.label}</span>
                        <span className="text-ink-700 text-xs leading-snug">{row.note}</span>
                      </div>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link href={row.href}>{COPY.adminPages.attention.review}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <ErrorState />
        )}

        {/* ── The trail's most recent rows ── */}
        {recent ? (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-ink-900 font-display text-[20px] leading-[1.5] font-bold">
                {COPY.adminPages.recent.title}
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/audit-log">{COPY.adminPages.recent.viewAll}</Link>
              </Button>
            </div>

            {recent.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title={COPY.adminPages.recent.emptyTitle}
                  description={COPY.adminPages.recent.emptyBody}
                />
              </div>
            ) : (
              <ul className="mt-3 flex flex-col">
                {recent.map((row) => (
                  /*
                    Three ranks per row, where there used to be two competing
                    ones. The action leads; who and what it touched drop to a
                    muted second line; the clock is pinned to the inline end so
                    the times form a column the eye can run down. The date is
                    dropped from the row — six rows of "today" is a column of
                    one repeated word — and the full stamp stays one click away
                    on the audit screen.
                  */
                  <li
                    key={row.id}
                    className="border-line-200 flex items-start gap-3 border-t py-2.5 first:border-t-0"
                  >
                    <span
                      aria-hidden="true"
                      className="rounded-control bg-brand-50 text-brand-700 mt-0.5 flex size-7 shrink-0 items-center justify-center"
                    >
                      <Activity className="size-4" />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-ink-900 text-[13.5px] leading-[1.6] font-medium">
                        {COPY.adminAudit.actionLabels[
                          row.action as keyof typeof COPY.adminAudit.actionLabels
                        ] ?? row.action}
                      </span>
                      {/*
                        An address and an identifier are Latin: each is isolated
                        so neither can reorder the Arabic around it.
                        `actorEmail` is a snapshot, so the trail stays readable
                        after an account is removed.
                      */}
                      <span className="text-ink-700 flex flex-wrap items-baseline gap-x-2 text-xs leading-[1.6]">
                        <bdi dir="ltr">{row.actorEmail ?? COPY.adminPages.recent.systemActor}</bdi>
                        <span aria-hidden="true">·</span>
                        <bdi dir="ltr" className="max-w-[22ch] truncate">
                          {row.targetId}
                        </bdi>
                      </span>
                    </div>

                    <span className="text-ink-700 mt-0.5 shrink-0 text-xs whitespace-nowrap">
                      {formatTime(row.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <ErrorState />
        )}
      </div>
    </div>
  );
}
