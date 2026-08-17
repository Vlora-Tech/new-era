# Bunny Stream

## Credentials

Three distinct keys, none interchangeable, all server-only:

| Variable | Purpose |
|---|---|
| `BUNNY_STREAM_LIBRARY_ID` | Identifies the library. Not secret, but configuration. |
| `BUNNY_STREAM_TOKEN_SECURITY_KEY` | Signs embed URLs. Leaking it makes every video publicly playable. |
| `BUNNY_STREAM_API_KEY` | Management API: look up a video's title, duration and processing state. Optional. |
| `BUNNY_STREAM_READONLY_API_KEY` | Verifies upload webhooks. Not used until the upload path is built. |

None is exposed to the browser, and a permanent playback URL is never stored. The
only thing that ever reaches a client is a signed URL that expires.

Without `BUNNY_STREAM_LIBRARY_ID` and `BUNNY_STREAM_TOKEN_SECURITY_KEY` the
player reports that video is not configured. It does not fail silently, and it
does not pretend a lesson is playable.

## Attaching a video

An administrator pastes the video's GUID. Two levels of checking:

1. **Format** — it must be a UUID. The reference project accepted any non-empty
   string, so a typo produced a lesson that looked playable and was not.
2. **Existence** — when `BUNNY_STREAM_API_KEY` is configured, the server calls
   `GET https://video.bunnycdn.com/library/{libraryId}/videos/{guid}` and stores
   the title, duration and processing state on `VideoAsset`. Without that key the
   identifier is accepted on format alone and the administrator is told it was
   not confirmed.

Duration matters beyond display: it sizes the playback token and it is what
completion is measured against.

## Protected playback

```
student opens a lesson
  → POST /api/lessons/[lessonId]/playback
      1. authenticate
      2. lesson published, module published
      3. preview lesson, or an ACTIVE entitlement on the course product
      4. create a PlaybackSession row with an expiry
      5. sign an embed URL with the same expiry
  → { sessionId, embedUrl, expiresAt, durationSec, resume, watermarkText }
```

Authorization is resolved **before** anything else about the lesson is reported,
including whether it has a video at all. Answering "this lesson has no video" to
someone with no right to the lesson would leak the curriculum's shape.

The signature follows Bunny's documented scheme:

```
token   = SHA256_HEX(tokenSecurityKey + videoGuid + expires)
embed   = https://iframe.mediadelivery.net/embed/{libraryId}/{videoGuid}
          ?token={token}&expires={expires}&autoplay=false&preload=true
```

`Cache-Control: no-store` on the response: it is a short-lived credential.

### Token lifetime

```
ttl = clamp(durationSec + 15 minutes, PLAYBACK_TOKEN_TTL_SECONDS, 4 hours)
```

A fixed 45-minute token — the reference project's behaviour — expires part-way
through a longer lesson and the player simply stops. The token is therefore sized
to the video, and the client additionally re-signs two minutes before expiry,
restoring the playback position afterwards.

## Progress, and why it is bounded

The player reports progress. A browser can report anything, so the server treats
every heartbeat as a claim to be checked rather than a fact to be stored.

The client accumulates **elapsed playback** from `timeupdate` events, counting
only forward motion and ignoring jumps larger than a normal tick — a seek moves
the position without adding watch time. Every 15 seconds, and on pause, end and
tab-hide (via `keepalive`, so the last one survives the page closing), it sends
`{ sessionId, positionSec, deltaSec }`.

The server then clamps:

```
elapsed  = now − (session.lastHeartbeatAt ?? session.createdAt)
accepted = min(deltaSec, ceil(elapsed × 2.25) + 5, durationSec)
```

2.25 is Bunny's fastest playback rate plus margin for jitter. A client claiming
an hour of viewing fifteen seconds after its last heartbeat is credited with
about 39 seconds.

The three stored values do different jobs:

- `watchedSec` — bounded, monotonic, and what **completion** is measured against.
  It is why seeking to the end does not complete a lesson.
- `lastPositionSec` — follows the player freely, because seeking is legitimate.
  This is what **resume** uses.
- `furthestPositionSec` — a high-water mark, never decreasing.

Completion fires once, at the lesson's threshold or the course default (90%),
and is written with a guard so a rewatch cannot un-complete a lesson.

Heartbeats are rate-limited per session rather than per user, so a student with
two lessons open is not penalised.

## Watermarking

A moving, semi-transparent mark carries the student's name, address and the last
eight characters of their account id. It raises the cost of passing a recording
around, because the recording identifies its source.

**It is a deterrent, not a control.** Expiring signed URLs discourage link
sharing and the watermark discourages redistribution. Neither prevents a screen
recorder, and nothing in the product claims otherwise. Widevine L1 — a paid Bunny
add-on — is the only thing that raises that bar meaningfully, and it is out of
scope.

## Dashboard settings to confirm before launch

Signing tokens in the application is only half the protection; the library must
be configured to require them.

- [ ] Enable **embed view token authentication** on the library. Until this is
      on, an unsigned embed URL still plays and the signing here achieves nothing.
- [ ] Restrict allowed referrers to the exact production and staging hostnames,
      without schemes.
- [ ] Block direct file access.
- [ ] Confirm whether the library serves the current player or the legacy iframe
      endpoint, and align the Content-Security-Policy `frame-src` with whichever
      host it actually uses.
- [ ] Test playback from an unauthorised origin and confirm it is refused.

## Player integration

Bunny's embed, driven through Player.js over `postMessage`. The iframe's document
is cross-origin and is never touched directly — reading into it is impossible by
design, and attempting it is how progress tracking usually ends up faked.

If the supported events prove unreliable against the real library, the documented
fallback is a custom HLS player using **path-style** tokens, so playlist segments
are protected too and not just the manifest. That is a deliberate future change,
not a silent workaround.

## Uploads — phase two, not built

An upgrade path exists but is out of scope for this MVP:

1. An authenticated administrator asks the server to create a Bunny video object.
2. The server returns a size-aware TUS authorisation valid for at least an hour,
   signed `SHA256(libraryId + apiKey + expiration + videoId)`.
3. The browser uploads directly to Bunny, resumably.
4. Bunny's webhook is verified against the **raw** request body using
   HMAC-SHA256 with the read-only key, compared in constant time.
5. The lesson stays `قيد المعالجة` until Bunny reports processing finished.

A separate test library should be used for this, never the production one.
