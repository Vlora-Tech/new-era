import 'server-only';

import type { Prisma } from '@prisma/client';

import { HttpError } from '@/lib/auth/guards';
import { COPY } from '@/lib/copy';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { AUDIT_ACTIONS, writeAuditLog, type AuditActor } from '@/services/audit/audit.service';
import {
  KNOWN_SETTING_KEYS,
  LEGAL_SETTING_FIELDS,
  SETTING_DEFAULTS,
  SETTING_FIELDS,
  SETTING_KEYS,
  isKnownSettingKey,
  type SettingField,
  type SettingKey,
  type TrackMapping,
  type UpdateSettingsInput,
} from '@/validators/admin-settings';

/**
 * Platform settings administration.
 *
 * `SiteSetting` is five rows of `Json`, which makes almost every property worth
 * having a property this file has to supply rather than one the schema enforces:
 *
 *  1. **The key space is closed.** `updateSettingsSchema` strips anything it
 *     does not declare, and `assertKnownKey` below refuses again on the way to
 *     the write. Two checks for one rule is not redundancy here — the model's
 *     own comment promises the store never holds a secret, and an allowlist is
 *     the only thing that keeps that promise against a future caller that skips
 *     the schema.
 *  2. **Stored values are read defensively.** The column is `Json` and the rows
 *     predate this screen, so a value can be any shape at all. Every read below
 *     narrows before it returns; a row holding a number where a string belongs
 *     reads as "not set", which is honest, rather than crashing the screen that
 *     exists to fix it.
 *  3. **A save that changes nothing writes nothing.** Keys whose value is
 *     already what was submitted are skipped, so neither `updatedAt` nor the
 *     audit trail records a decision nobody took.
 *  4. **Every change is audited inside its own transaction**, one row per key,
 *     carrying the value before and after.
 *
 * On `site-setting-repository.ts`: `getSettings` and `getCurrentLegalVersions`
 * are the right calls for every reader that wants a value, and the rest of the
 * platform uses them. This screen needs two things they do not answer — who last
 * changed each key and when — and a write that commits with its audit row.
 * `setSetting` runs on the root client, so a mutation routed through it would
 * leave the audit write in a separate transaction, which is exactly the failure
 * `writeAuditLog` documents. Hence the direct model access here, and only here.
 */

export type AdminSettingsContext = {
  actor: AuditActor;
  requestId?: string;
};

/** Who last touched a key, for the line under each field. */
export type AdminSettingMeta = {
  key: SettingKey;
  updatedAt: Date | null;
  updatedByName: string | null;
  updatedByEmail: string | null;
};

export type AdminSettingsValues = {
  termsVersion: string;
  privacyVersion: string;
  contactEmail: string;
  contactPhone: string;
  examTrackMapping: TrackMapping;
};

export type AdminSettings = {
  values: AdminSettingsValues;
  meta: Record<SettingField, AdminSettingMeta>;
  /**
   * False when not one of the five keys has a row yet.
   *
   * Distinct from a failed read, which the page renders as `ErrorState`. This is
   * "the store is empty and you are looking at the defaults", which is a true
   * statement about a fresh installation and needs its own sentence.
   */
  seeded: boolean;
};

const SETTINGS_COPY = COPY.adminSettings;

// ── Defensive readers ────────────────────────────────────────────────────

/** A stored value narrowed to a string, or the default when it is anything else. */
function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * A stored value narrowed to the track mapping.
 *
 * Each of the three parts is checked separately, so a row with a good `note` and
 * a corrupted `scientific` keeps the note. Dropping the whole object on one bad
 * field would lose the source attribution, which is the part nobody can
 * reconstruct from memory.
 */
function readTrackMapping(value: unknown): TrackMapping {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return SETTING_DEFAULTS.examTrackMapping;
  }

  const record = value as Record<string, unknown>;
  const list = (entry: unknown): string[] =>
    Array.isArray(entry) ? entry.filter((item): item is string => typeof item === 'string') : [];

  return {
    note: readString(record.note, ''),
    scientific: list(record.scientific),
    theoretical: list(record.theoretical),
  };
}

function emptyMeta(key: SettingKey): AdminSettingMeta {
  return { key, updatedAt: null, updatedByName: null, updatedByEmail: null };
}

// ── Reads ────────────────────────────────────────────────────────────────

const SETTING_ROW_SELECT = {
  key: true,
  value: true,
  updatedAt: true,
  updatedBy: { select: { name: true, email: true } },
} satisfies Prisma.SiteSettingSelect;

/**
 * Every known setting, whether or not a row exists for it.
 *
 * The screen always renders all five fields: a key with no row is not a missing
 * field, it is a field holding its default, and hiding it would leave an
 * administrator unable to set the value they came to set.
 */
export async function getAdminSettings(): Promise<AdminSettings> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [...KNOWN_SETTING_KEYS] } },
    select: SETTING_ROW_SELECT,
  });

  const byKey = new Map(rows.map((row) => [row.key, row]));

  const meta = Object.fromEntries(
    SETTING_FIELDS.map((field) => {
      const key = SETTING_KEYS[field];
      const row = byKey.get(key);
      return [
        field,
        row
          ? {
              key,
              updatedAt: row.updatedAt,
              updatedByName: row.updatedBy?.name ?? null,
              updatedByEmail: row.updatedBy?.email ?? null,
            }
          : emptyMeta(key),
      ];
    }),
  ) as Record<SettingField, AdminSettingMeta>;

  return {
    values: {
      termsVersion: readString(
        byKey.get(SETTING_KEYS.termsVersion)?.value,
        SETTING_DEFAULTS.termsVersion,
      ),
      privacyVersion: readString(
        byKey.get(SETTING_KEYS.privacyVersion)?.value,
        SETTING_DEFAULTS.privacyVersion,
      ),
      contactEmail: readString(
        byKey.get(SETTING_KEYS.contactEmail)?.value,
        SETTING_DEFAULTS.contactEmail,
      ),
      contactPhone: readString(
        byKey.get(SETTING_KEYS.contactPhone)?.value,
        SETTING_DEFAULTS.contactPhone,
      ),
      examTrackMapping: readTrackMapping(byKey.get(SETTING_KEYS.examTrackMapping)?.value),
    },
    meta,
    seeded: rows.length > 0,
  };
}

// ── Writes ───────────────────────────────────────────────────────────────

/**
 * The last gate before a key reaches the database.
 *
 * Unreachable through the route — Zod has already stripped anything not named in
 * `updateSettingsSchema` — and kept because this function is callable from a
 * script that never went near a request. The store's promise that it holds no
 * secret is worth more than one check.
 */
function assertKnownKey(key: string): asserts key is SettingKey {
  if (!isKnownSettingKey(key)) {
    throw new HttpError(400, SETTINGS_COPY.errors.unknownKey, 'setting_unknown_key');
  }
}

/** Structural comparison, so `{a:1,b:2}` and `{b:2,a:1}` do not read as a change. */
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

type PendingWrite = { field: SettingField; key: SettingKey; value: unknown };

/**
 * Collect the fields the request actually carried.
 *
 * An absent field is not an instruction to clear a key — it is the caller saying
 * nothing about it. That distinction is what lets one endpoint serve both the
 * whole form and a single field without a partial save silently emptying the
 * four keys it did not mention.
 */
function pendingWrites(input: UpdateSettingsInput): PendingWrite[] {
  const writes: PendingWrite[] = [];

  for (const field of SETTING_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;

    const key = SETTING_KEYS[field];
    assertKnownKey(key);
    writes.push({ field, key, value });
  }

  return writes;
}

/**
 * Save the settings that changed.
 *
 * The legal gate is the one thing here that refuses rather than validates.
 * `ConsentRecord` stores `termsVersion` and `privacyVersion` as they stood when
 * a person accepted, and `getCurrentLegalVersions` reads these two keys to
 * decide what the next acceptance records. Changing one is therefore a statement
 * that the document itself changed: every consent taken from that moment names
 * the new text, and every consent already taken keeps naming the old one. That
 * is correct and it is irreversible in the only sense that matters — the
 * evidence of who agreed to what is now split across two versions, and typing
 * the old string back does not merge them.
 *
 * So the change needs an explicit acknowledgement, which the screen collects in
 * a confirmation the administrator reads before pressing anything. A request
 * without it is refused, whatever it is coming from.
 */
export async function updateAdminSettings(
  input: UpdateSettingsInput,
  context: AdminSettingsContext,
): Promise<{ settings: AdminSettings; changed: SettingKey[] }> {
  const writes = pendingWrites(input);

  const changed = await prisma.$transaction(async (tx) => {
    const existing = await tx.siteSetting.findMany({
      where: { key: { in: writes.map((write) => write.key) } },
      select: { key: true, value: true },
    });
    const currentByKey = new Map(existing.map((row) => [row.key, row.value as unknown]));

    const effective = writes.filter(
      (write) => !sameValue(currentByKey.get(write.key), write.value),
    );

    const legalKeys = LEGAL_SETTING_FIELDS.map((field) => SETTING_KEYS[field]);
    const touchesLegal = effective.some((write) => legalKeys.includes(write.key));
    if (touchesLegal && !input.acknowledgeLegalChange) {
      throw new HttpError(
        409,
        SETTINGS_COPY.errors.legalChangeUnconfirmed,
        'setting_legal_change_unconfirmed',
      );
    }

    for (const write of effective) {
      await tx.siteSetting.upsert({
        where: { key: write.key },
        create: {
          key: write.key,
          value: write.value as Prisma.InputJsonValue,
          updatedById: context.actor.id,
        },
        update: { value: write.value as Prisma.InputJsonValue, updatedById: context.actor.id },
      });

      // One row per key, because one key is one decision. `targetId` carries the
      // key string rather than a uuid — `SiteSetting` is the one audited model
      // whose primary key is its name, and the trail is more readable for it.
      await writeAuditLog(tx, {
        actor: context.actor,
        action: AUDIT_ACTIONS.SETTING_UPDATED,
        targetType: 'SiteSetting',
        targetId: write.key,
        metadata: {
          settingKey: write.key,
          before: currentByKey.get(write.key) ?? null,
          after: write.value,
        },
        requestId: context.requestId,
      });
    }

    return effective.map((write) => write.key);
  });

  if (changed.length > 0) {
    logger.info('site settings updated', {
      keys: changed,
      actorId: context.actor.id,
      requestId: context.requestId,
    });
  }

  // Re-read outside the transaction so the response carries the stamped
  // `updatedAt` and the resolved editor name, not the values that were sent.
  return { settings: await getAdminSettings(), changed };
}
