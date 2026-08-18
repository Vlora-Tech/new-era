/**
 * What a Bunny Stream video identifier looks like.
 *
 * This is deliberately its own module rather than a constant on
 * `services/video/video-provider.ts`, where it used to live. That module is
 * `server-only` — it signs playback URLs with the token-security key — so
 * anything importing it is pulled server-side. The identifier's *shape*,
 * however, is needed in three places on both sides of the boundary:
 *
 *  - the playback signer, on the server;
 *  - `validators/admin-video.ts`, which a `'use client'` form imports so the
 *    administrator sees a typo before a request is made;
 *  - the registration service, on the server again.
 *
 * With the constant behind `server-only`, the client form's import chain reached
 * a server module and the production build failed — while `tsc` stayed perfectly
 * happy, because a type-level graph has no notion of which bundle a module lands
 * in. Hence a module with no imports at all: a pure fact about a string, safe to
 * pull into either bundle, and defined exactly once so the form, the service and
 * the signer cannot drift about what a valid identifier is.
 */

/** Bunny video identifiers are UUIDs; anything else is a typo, not a video. */
export const BUNNY_GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a string can identify a Bunny video at all.
 *
 * Case-insensitive because Bunny's dashboard and its API disagree about casing,
 * and an administrator copying from either should not have to care. Callers that
 * persist the value lowercase it first, so the unique index sees one spelling.
 */
export function isBunnyVideoGuid(value: string): boolean {
  return BUNNY_GUID_PATTERN.test(value);
}
