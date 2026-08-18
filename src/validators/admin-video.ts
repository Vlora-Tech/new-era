import { z } from 'zod';

// From `@/lib/video-guid`, not the video provider: that module is `server-only`
// and this file is imported by a client form, so reaching into it would pull a
// server module into the browser bundle — a build failure `tsc` cannot see.
import { BUNNY_GUID_PATTERN } from '@/lib/video-guid';

/**
 * Registering a Bunny Stream video against the platform.
 *
 * The screen this validates is deliberately *not* an upload form. The bytes live
 * at Bunny and are uploaded in Bunny's own dashboard; what this platform stores
 * is the pair that identifies one video, so playback can be signed per request.
 *
 * Two fields exist on `VideoAsset` and only one of them is ever accepted here:
 *
 *  - `libraryId` is **stripped by omission**. It is server configuration
 *    (`BUNNY_STREAM_LIBRARY_ID`), identical for every video in an environment,
 *    and the service reads it. Accepting it from a browser would let a request
 *    register an identifier pointing into somebody else's library — a row whose
 *    playback URL this platform could sign but whose content it does not own.
 *  - `videoGuid` is the one value a human genuinely has to carry across, so it
 *    is the one value the form asks for.
 *
 * `title` and `durationSec` are accepted but treated as a fallback: when a
 * management key is configured the service overwrites both with Bunny's own
 * answer, because a typed title drifts from the library the moment somebody
 * renames the video there.
 */

/**
 * Bunny video identifiers are UUIDs. The pattern is imported rather than
 * restated so the form, the service and the playback signer cannot disagree
 * about what an identifier looks like.
 */
export const bunnyVideoGuidSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(BUNNY_GUID_PATTERN, 'معرّف المقطع غير صحيح. انسخه من صفحة المقطع في Bunny Stream.');

export const videoAssetIdSchema = z.uuid('معرّف المقطع غير صحيح');

export const registerVideoSchema = z.object({
  videoGuid: bunnyVideoGuidSchema,
  /*
   * Optional, and only used when Bunny cannot be asked. Capped well below the
   * column's practical limit so a pasted page of text cannot become a title.
   *
   * `.nullish()` and not `.optional()`: this schema has to accept its own output
   * — see the note at the foot of the file — and the transform below produces
   * `null` for a blank field. The shape is `optionalText` in `admin-course.ts`
   * and `admin-product.ts`, restated rather than shared only because those two
   * helpers are private to their files.
   */
  title: z
    .string()
    .trim()
    .max(200, 'اسم المقطع طويل جدًا')
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null),
  /*
   * Eight hours. A lesson longer than that is a data-entry mistake, and the
   * value feeds `playbackTtlSeconds`, which sizes a signed token to it.
   */
  durationSec: z.coerce
    .number()
    .int('مدة المقطع غير صحيحة')
    .min(0, 'مدة المقطع غير صحيحة')
    .max(8 * 60 * 60, 'مدة المقطع غير صحيحة')
    .optional()
    .nullable()
    .transform((value) => (value === undefined ? null : value)),
});

export const videoListQuerySchema = z.object({
  q: z.string().trim().max(160).optional().catch(undefined),
  /*
   * `.catch()` throughout: this is a browsing request, and a hand-edited query
   * string should degrade to the default view rather than answer 400.
   */
  attached: z.enum(['all', 'attached', 'unattached']).catch('all'),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});

/**
 * The schema's two faces.
 *
 * `.transform()` makes the parsed output differ from what a form actually holds
 * — a blank optional title is `''` in the DOM and `null` after parsing — so
 * react-hook-form has to be told both. `useForm<Values, unknown, Input>` takes
 * the form's own shape first and the parsed shape last; collapsing them into one
 * type is what produces the resolver mismatch this pair exists to avoid.
 *
 * THE ROUND-TRIP RULE, which every body schema on this project has to satisfy:
 * **the output must be a valid input.** The browser parses with this schema
 * through `zodResolver`, posts the *parsed* values, and the route parses the
 * same schema again — so any field whose transform emits a value its own input
 * rejects fails 100% of the time, in the route, after the form said it was
 * valid. `title` did exactly that: it emitted `null` for a blank field while
 * accepting only `string | undefined`, so every registration answered 400 with
 * "expected string, received null" — and always, not just on a blank title,
 * because the form defaults it to `''` and the field is not even rendered when
 * a management key is configured. Query schemas above are exempt: they are
 * parsed once, on the server, from a URL.
 */
export type RegisterVideoFormValues = z.input<typeof registerVideoSchema>;
export type RegisterVideoInput = z.output<typeof registerVideoSchema>;
export type VideoListQuery = z.infer<typeof videoListQuerySchema>;
