import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import { CoveragePanel } from '@/components/admin/blueprint-rule-editor';
import { ExamVersionEditor } from '@/components/admin/exam-version-editor';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/surface';
import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { formatNumber } from '@/lib/format';
import { logger } from '@/lib/logger';
import {
  buildCoverageReport,
  getExamVersionForAdmin,
  parseExamVersionId,
  type AdminExamVersionDetail,
  type CoverageReport,
} from '@/services/exams/exam-version-admin.service';
import { parseSimulatorId } from '@/services/exams/simulator-admin.service';

export const metadata: Metadata = { title: COPY.adminSimulators.versions.editTitle };

/**
 * One version: its fields, its sections, their rules, and the coverage check.
 *
 * The coverage report is computed here rather than fetched after mount, so the
 * shortfalls are on the page the moment it paints — the panel's own button
 * re-runs it after a rule changes. It is read in its own try/catch and kept
 * nullable: the bank query can fail while the version itself loaded perfectly
 * well, and the panel says "could not load" instead of drawing an all-clear
 * nobody computed.
 *
 * The `simulatorId` in the path is verified against the version's own. The
 * version knows which simulator it belongs to, so a mismatched path is a wrong
 * address rather than a permission problem, and `notFound()` is the honest
 * answer — it also stops a version being reachable under a simulator whose
 * breadcrumb would then lie about where it lives.
 */
export default async function AdminExamVersionPage({
  params,
}: {
  params: Promise<{ simulatorId: string; versionId: string }>;
}) {
  const { simulatorId, versionId } = await params;

  let version: AdminExamVersionDetail | null = null;
  let failed = false;
  try {
    const id = parseSimulatorId(simulatorId);
    version = await getExamVersionForAdmin(parseExamVersionId(versionId));
    if (version && version.simulatorId !== id) version = null;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    logger.error('admin exam version load failed', { simulatorId, versionId, error });
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHead title={COPY.adminSimulators.versions.editTitle} />
        <ErrorState
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href={`/admin/simulators/${simulatorId}`}>
                {COPY.adminSimulators.backToSimulators}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!version) notFound();

  let coverage: CoverageReport | null = null;
  try {
    coverage = await buildCoverageReport(version);
  } catch (error) {
    logger.error('admin coverage report failed', { versionId, error });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={`${COPY.adminSimulators.versions.columns.versionNumber} ${formatNumber(version.versionNumber)} — ${version.productTitle}`}
        description={COPY.adminSimulators.versions.description}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/simulators/${version.simulatorId}`}>
              {COPY.adminSimulators.backToSimulators}
            </Link>
          </Button>
        }
      />

      <ExamVersionEditor version={version} />

      <CoveragePanel versionId={version.id} report={coverage} />
    </div>
  );
}
