import { z } from 'zod';

import { LEGAL_VERSION_KEYS } from '@/lib/constants';
import { COPY } from '@/lib/copy';

/**
 * The platform settings store, as a schema.
 *
 * `SiteSetting` is a `key`/`value Json` table, which is one keystroke away from
 * being a free-form JSON editor. It is not one, and this file is what stops it
 * becoming one:
 *
 *  1. **The key space is closed.** `updateSettingsSchema` declares five named
 *     fields and Zod strips everything else, so a request carrying
 *     `"payments.secretKey"` does not arrive at the service with an unknown key
 *     to reject — it arrives with that key already gone. The schema comment on
 *     the model says the store never holds secrets; an allowlist is how that
 *     sentence stays true after the fifth person edits this screen.
 *  2. **Each key has its own value schema.** A version string, an address, a
 *     Saudi mobile number and a track mapping are four different shapes, and a
 *     textarea that accepted any of them would accept a typo in all four.
 *  3. **A legal version change must be acknowledged.** `ConsentRecord` stores
 *     the version string in force when a person agreed, so changing one is a
 *     statement that the text itself changed. The browser asks first; the schema
 *     carries the answer so a request that never went near the form is refused
 *     rather than obeyed.
 *
 * Messages come from `COPY.adminSettings.errors` rather than being written
 * inline. The screen states the same rules in its hints, and a validator with
 * its own wording is how a field ends up explaining itself two different ways.
 */

const ERRORS = COPY.adminSettings.errors;

/**
 * Every key this screen may write, camelCase field name → stored key.
 *
 * The two legal keys are taken from `LEGAL_VERSION_KEYS` rather than retyped:
 * `getCurrentLegalVersions` reads the store through those same constants, and
 * two spellings of `legal.termsVersion` would mean this screen edits a row
 * nothing reads.
 */
export const SETTING_KEYS = {
  termsVersion: LEGAL_VERSION_KEYS.terms,
  privacyVersion: LEGAL_VERSION_KEYS.privacy,
  contactEmail: 'contact.email',
  contactPhone: 'contact.phone',
  examTrackMapping: 'exam.trackMapping',
} as const;

export type SettingField = keyof typeof SETTING_KEYS;
export type SettingKey = (typeof SETTING_KEYS)[SettingField];

export const SETTING_FIELDS = Object.keys(SETTING_KEYS) as readonly SettingField[];
export const KNOWN_SETTING_KEYS = Object.values(SETTING_KEYS) as readonly SettingKey[];

/** The two keys whose change alters what a future consent record means. */
export const LEGAL_SETTING_FIELDS: readonly SettingField[] = ['termsVersion', 'privacyVersion'];

export function isKnownSettingKey(key: string): key is SettingKey {
  return (KNOWN_SETTING_KEYS as readonly string[]).includes(key);
}

// ── Value schemas, one per key ───────────────────────────────────────────

/**
 * A document version: a short opaque label, ASCII, no spaces.
 *
 * Deliberately not a date and not a number. It is an identifier that has to
 * survive being copied into a consent row, quoted in a support reply and
 * compared by eye months later, so `2026-08-17.1` and `v3` are both fine and
 * `النسخة الأولى` is not — an Arabic version string reads correctly here and
 * illegibly inside a Latin uuid-shaped record.
 */
export const legalVersionSchema = z
  .string()
  .trim()
  .min(1, ERRORS.versionFormat)
  .max(40, ERRORS.versionFormat)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, ERRORS.versionFormat);

/** Published on the contact page, so it is normalised the way an account is. */
export const contactEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, ERRORS.emailFormat)
  .max(254, ERRORS.emailFormat)
  .pipe(z.email(ERRORS.emailFormat));

const SAUDI_MOBILE_PATTERN = /^(?:\+9665|009665|9665|05|5)\d{8}$/;

/**
 * A Saudi mobile number, or nothing at all.
 *
 * Empty is a first-class value rather than an error: the field's hint says a
 * number nobody answers is worse than no number, and a schema that forced one
 * would make the honest choice impossible. What survives is stored in a single
 * normalised form, because the same number typed as `0512345678` and
 * `+966512345678` is one number and must not read as two on the public page.
 */
export const contactPhoneSchema = z
  .string()
  .trim()
  // Separators a person types and a machine should not care about: spaces,
  // brackets, and every dash a keyboard or a paste can produce.
  .transform((value) => value.replace(/[\s()]/g, '').replace(/[-‐-―]/g, ''))
  .refine((value) => value.length === 0 || SAUDI_MOBILE_PATTERN.test(value), ERRORS.phoneFormat)
  .transform((value) => (value.length === 0 ? '' : `+9665${value.slice(-8)}`));

/**
 * One declared track name.
 *
 * `NFKC` then a whitespace collapse, so `المسار  العام` and `المسار العام`
 * cannot both be listed — the duplicate check below compares these normalised
 * strings, and without the fold two visually identical names would sit on
 * opposite sides of the mapping without tripping it.
 */
const trackNameSchema = z
  .string()
  .trim()
  .min(1, ERRORS.trackMappingFormat)
  .max(120, ERRORS.trackMappingFormat)
  .transform((value) => value.normalize('NFKC').replace(/\s+/g, ' '));

const MAX_TRACKS_PER_LIST = 60;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * The published-track → platform-track mapping.
 *
 * Kept as a structured object with a `note`, not as free text: the note records
 * where the classification came from and when the platform last checked it,
 * which is the difference between a documented reading of a public guide and an
 * unattributed guess about somebody's eligibility.
 */
export const trackMappingSchema = z
  .object({
    note: z.string().trim().max(600, ERRORS.trackMappingFormat).default(''),
    scientific: z.array(trackNameSchema).max(MAX_TRACKS_PER_LIST).default([]),
    theoretical: z.array(trackNameSchema).max(MAX_TRACKS_PER_LIST).default([]),
  })
  .transform((value) => ({
    note: value.note,
    scientific: unique(value.scientific),
    theoretical: unique(value.theoretical),
  }))
  .refine((value) => value.scientific.every((track) => !value.theoretical.includes(track)), {
    message: ERRORS.trackMappingDuplicate,
    path: ['theoretical'],
  });

export type TrackMapping = z.infer<typeof trackMappingSchema>;

/** What a key holds when no row has been written for it yet. */
export const SETTING_DEFAULTS: {
  termsVersion: string;
  privacyVersion: string;
  contactEmail: string;
  contactPhone: string;
  examTrackMapping: TrackMapping;
} = {
  termsVersion: '',
  privacyVersion: '',
  contactEmail: '',
  contactPhone: '',
  examTrackMapping: { note: '', scientific: [], theoretical: [] },
};

// ── The request body ─────────────────────────────────────────────────────

/**
 * A settings save.
 *
 * Every field is optional so the endpoint can carry one key or all five, and the
 * service writes only the keys whose value actually differs — a save that
 * changed nothing writes no row and no audit entry, because a trail full of
 * "changed the settings to what they already were" is a trail nobody reads.
 *
 * `acknowledgeLegalChange` is not a preference. It defaults to `false`, and the
 * service refuses a changed legal version without it.
 */
export const updateSettingsSchema = z.object({
  termsVersion: legalVersionSchema.optional(),
  privacyVersion: legalVersionSchema.optional(),
  contactEmail: contactEmailSchema.optional(),
  contactPhone: contactPhoneSchema.optional(),
  examTrackMapping: trackMappingSchema.optional(),
  acknowledgeLegalChange: z.boolean().default(false),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ── The browser form ─────────────────────────────────────────────────────

/**
 * Two lists edited as two textareas, one track per line.
 *
 * The wire format stays an array of strings; the conversion lives here so the
 * form and the endpoint cannot disagree about what a line means. It is a helper
 * rather than a Zod transform for the same reason `riyalsToHalalas` is:
 * react-hook-form submits a schema's *output*, so a transform would make the
 * browser post an array to a resolver whose input is a string.
 */
export function linesToTracks(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function tracksToLines(tracks: readonly string[]): string {
  return tracks.join('\n');
}

const MAX_TRACK_TEXT = 4_000;

/**
 * The shape the browser form holds.
 *
 * The duplicate rule is re-stated here as a `superRefine` rather than borrowed
 * from `trackMappingSchema`, because the form holds two blocks of text and the
 * mapping holds two arrays. Checking it on the form is what puts the message
 * under the textarea that has to change; the object schema above still checks it
 * server-side, where it is the one that actually decides.
 */
export const settingsFormSchema = z
  .object({
    termsVersion: legalVersionSchema,
    privacyVersion: legalVersionSchema,
    contactEmail: contactEmailSchema,
    contactPhone: contactPhoneSchema,
    trackMappingNote: z.string().trim().max(600, ERRORS.trackMappingFormat),
    trackMappingScientific: z.string().max(MAX_TRACK_TEXT, ERRORS.trackMappingFormat),
    trackMappingTheoretical: z.string().max(MAX_TRACK_TEXT, ERRORS.trackMappingFormat),
  })
  .superRefine((values, ctx) => {
    const normalise = (line: string) => line.normalize('NFKC').replace(/\s+/g, ' ');
    const scientific = new Set(linesToTracks(values.trackMappingScientific).map(normalise));
    const overlap = linesToTracks(values.trackMappingTheoretical)
      .map(normalise)
      .filter((track) => scientific.has(track));

    if (overlap.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['trackMappingTheoretical'],
        message: ERRORS.trackMappingDuplicate,
      });
    }
  });

export type SettingsFormValues = z.input<typeof settingsFormSchema>;
export type SettingsFormOutput = z.output<typeof settingsFormSchema>;

/** Fold the form's flat fields back into the request body. */
export function settingsFormToInput(
  values: SettingsFormOutput,
  acknowledgeLegalChange: boolean,
): UpdateSettingsInput {
  return {
    termsVersion: values.termsVersion,
    privacyVersion: values.privacyVersion,
    contactEmail: values.contactEmail,
    contactPhone: values.contactPhone,
    examTrackMapping: {
      note: values.trackMappingNote,
      scientific: unique(linesToTracks(values.trackMappingScientific)),
      theoretical: unique(linesToTracks(values.trackMappingTheoretical)),
    },
    acknowledgeLegalChange,
  };
}
