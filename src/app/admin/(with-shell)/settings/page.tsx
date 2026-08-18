import type { Metadata } from 'next';

import { AdminPageHead } from '@/components/admin/admin-page-head';
import {
  SettingsForm,
  type SettingsFieldMeta,
  type SettingsMetaMap,
} from '@/components/admin/settings-form';
import { ErrorState } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';
import { formatDateTime } from '@/lib/format';
import { logger } from '@/lib/logger';
import {
  getAdminSettings,
  type AdminSettingMeta,
  type AdminSettings,
} from '@/services/settings/settings-admin.service';
import { tracksToLines } from '@/validators/admin-settings';

export const metadata: Metadata = { title: COPY.admin.settings };

/**
 * Platform settings.
 *
 * One read produces the whole screen, so a thrown query renders `ErrorState`
 * instead of the form — the same decision `products/[productId]/page.tsx`
 * makes, and the reason `DetailPanel` has no `failed` prop. A settings form
 * drawn from a failed read would show five empty boxes, and saving them would
 * blank five live values.
 *
 * The timestamps are formatted here rather than in the client component. They
 * are rendered in Riyadh time through `Intl`, and formatting on the server keeps
 * the markup identical on both sides of hydration regardless of where the
 * reader's browser thinks it is.
 */
function toFieldMeta(meta: AdminSettingMeta): SettingsFieldMeta {
  return {
    updatedAt: meta.updatedAt ? formatDateTime(meta.updatedAt) : null,
    // The name if the account still exists, the address as a fallback, and null
    // when the row was written without an actor — a seed, or a migration.
    updatedBy: meta.updatedByName ?? meta.updatedByEmail ?? null,
  };
}

function toMetaMap(settings: AdminSettings): SettingsMetaMap {
  return {
    termsVersion: toFieldMeta(settings.meta.termsVersion),
    privacyVersion: toFieldMeta(settings.meta.privacyVersion),
    contactEmail: toFieldMeta(settings.meta.contactEmail),
    contactPhone: toFieldMeta(settings.meta.contactPhone),
    examTrackMapping: toFieldMeta(settings.meta.examTrackMapping),
  };
}

export default async function AdminSettingsPage() {
  let settings: AdminSettings | null = null;
  try {
    settings = await getAdminSettings();
  } catch (error) {
    logger.error('admin settings read failed', { error });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHead
        title={COPY.adminSettings.title}
        description={COPY.adminSettings.description}
      />

      {settings === null ? (
        <ErrorState />
      ) : (
        <SettingsForm
          initial={{
            termsVersion: settings.values.termsVersion,
            privacyVersion: settings.values.privacyVersion,
            contactEmail: settings.values.contactEmail,
            contactPhone: settings.values.contactPhone,
            trackMappingNote: settings.values.examTrackMapping.note,
            trackMappingScientific: tracksToLines(settings.values.examTrackMapping.scientific),
            trackMappingTheoretical: tracksToLines(settings.values.examTrackMapping.theoretical),
          }}
          meta={toMetaMap(settings)}
          seeded={settings.seeded}
        />
      )}
    </div>
  );
}
