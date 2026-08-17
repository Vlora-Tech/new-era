# Media storage

Two kinds of file, with different rules:

| Kind              | Visibility  | Example                                  |
| ----------------- | ----------- | ---------------------------------------- |
| Catalogue artwork | `PUBLIC`    | Product covers                           |
| Question stimuli  | `PROTECTED` | A passage image, a chart, a table figure |

The distinction matters commercially. A cover is marketing and should be cached
aggressively. A question image is paid bank content, and serving it from a
permanently public URL would put the product's stock-in-trade on the open web
regardless of what the application checks.

## The boundary

`StorageProvider` exposes `put`, `getStream`, `delete` and `publicUrl`. The
production adapter is deliberately **not** chosen: the brief requires the owner
to approve a provider and its credentials first, and creating a bucket implies
cost and a data-residency decision that the privacy review has not yet settled.

## Local development

Files live under `STORAGE_LOCAL_ROOT` (default `.storage/`), which is **outside
`public/`** and git-ignored:

```
.storage/
  public/<uuid>.<ext>
  protected/<uuid>.<ext>
```

Putting them in `public/` would let Next serve every protected stimulus directly,
bypassing every check in the application. The directory layout is the enforcement.

Keys are generated UUIDs. A user-supplied filename never reaches the object
store, which removes path traversal as a category rather than filtering for it.

## Serving

- **Public** — a route validating the key shape, with a long immutable cache.
- **Protected** — a route that authenticates, authorises against the asset's
  actual use, sets `Cache-Control: private, no-store`, and sends the content type
  recorded at upload rather than one sniffed at request time.

The authorised route _is_ the short-lived access in development. An S3 adapter
would swap in pre-signed GETs behind the same interface without the callers
changing.

## Upload validation

In order, because each step assumes the previous one passed:

1. Size caps: 3 MB for covers, 2 MB for stimuli.
2. MIME allowlist: `image/jpeg`, `image/png`, `image/webp`. **No SVG** — it is a
   document format that executes script, so it is an XSS vector wearing an image
   extension.
3. Magic-byte sniff, which must agree with the declared type. A declared type is
   a claim by the uploader.
4. Decode and re-encode, which strips metadata and anything hidden after the
   image data, and enforces a maximum dimension.
5. Checksum, then record the `MediaAsset` row.

## Deletion

An asset in use cannot be deleted out from under the content that references it.
Deletion checks for references first and refuses rather than leaving a product
page or a question pointing at nothing.

## Production

`STORAGE_PROVIDER=local` **fails startup** when `NODE_ENV=production`. Local disk
on typical hosting is ephemeral: uploads would appear to work and then vanish on
the next deploy, which is worse than refusing them.

Until an approved provider is configured, upload actions are disabled with a
clear Arabic message and seeded local assets are development-only.

### Still required

- [ ] Owner approves a production storage provider and region — the region is
      part of the personal-data review, not just an infrastructure preference.
- [ ] Decide retention for uploads belonging to deleted accounts.
- [ ] Confirm cache rules keep protected content out of any shared CDN cache.
