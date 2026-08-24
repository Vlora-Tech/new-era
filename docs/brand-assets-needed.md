# Brand assets still required

> **New artwork supplied 2026-08-25.** Three colourways, each a stacked lockup
> at 1610 × 2000, each carrying both wordmarks:
>
> | File | Tile | Calligraphy |
> | ---- | ---- | ----------- |
> | `new-era-lockup-blue-on-dark.png` **(in use)** | dark | blue |
> | `new-era-lockup-white-on-dark.png` | dark | white |
> | `new-era-lockup-blue-on-light.png` | light | blue |
>
> The owner chose blue-on-dark. `LOGO_SRC` in `src/components/layout/brand.tsx`
> is the single constant that switches it.
>
> **None of the three is a symbol-only mark**, so item 2 below is still open and
> the favicon is still a generated placeholder. The wordmarks are present in
> every file; a compact mark must be commissioned rather than trimmed out of
> one of these.
>
> **The proportions inverted.** The new lockup is taller than wide (ratio 1.242)
> where the old was wider than tall (0.806). The public bar grew from
> `h-20 lg:h-24` to `h-36 lg:h-44` to hold it, because at the 128px width the
> wordmark needs, the mark is 159px tall. The width itself is measured, not
> guessed: the Arabic wordmark is 140px in both files, but that is 12.4% of the
> old canvas and 7.0% of the new one, so 112px would have shrunk it below the
> previous legibility. The owner accepted the taller bar and its cost in fold
> space, over a smaller mark. Item 1 still removes the trade entirely.
>
> The drawer's `max-h` and every landing section's `scroll-mt` subtract the bar
> height and moved with it.

The previously supplied logo was a single raster file, a stacked lockup with
Arabic and Latin wordmarks on a white background. It remains in
`public/brand/new-era-logo.png`, referenced by nothing.

The brand guidelines state that it must not be cropped, recoloured, stretched,
rotated, masked, or have the upper symbol extracted from it, and that it should
be used at 220px wide or more so both wordmarks stay legible. They also say that
a compact mark should be **commissioned**, not improvised from this file.

## What the platform does today

> **Owner-directed deviation (2026-08-17).** The owner asked for the supplied
> artwork in the public navigation bar rather than set type. It is now there, at
> 112px wide on desktop and 88px on mobile, which puts the Arabic wordmark near
> 13px — readable, but below the 220px the guidelines ask for.
>
> To keep that honest the bar was made taller (80px, rising to 96px at the `lg`
> breakpoint) rather than the mark made smaller, and nothing is cropped,
> recoloured, stretched, masked or blended. The artwork's own white ground sits
> on the bar's white surface, so no blend mode is involved.
>
> The commissioned horizontal lockup removes the compromise entirely: set
> `HORIZONTAL_LOCKUP_SRC` in `src/components/layout/brand.tsx`, along with the
> delivered file's true pixel dimensions, and every bar on the site switches at
> once.

| Placement                      | Mark used                                                              | Why                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public header**              | **Full logo, 112px wide (88px on mobile), on the bar's white surface** | The owner's instruction, implemented by making the bar tall enough for the mark (80px, 96px at `lg`) instead of shrinking the mark. Below the 220px floor — see the deviation note above. The separate masthead band it replaced was removed, which also lifted the hero back above the fold. |
| Dashboard and admin rails      | Typographic wordmark                                                   | Those rails are 264px wide and already carry a section title beside the mark; a lockup there would compete with it rather than sit in a bar of its own.                                                                                                                                       |
| Sign-in and registration pages | Full logo, 220px, on white, with 12% clear space                       | There is vertical room, and the page benefits from the real mark.                                                                                                                                                                                                                             |
| Public footer                  | Full logo, 220px, on white, flush to the grid                          | Same.                                                                                                                                                                                                                                                                                         |

## Assets to commission

1. **Horizontal lockup** — symbol beside the wordmark, for headers and
   navigation bars where vertical space is limited. Needed as SVG. It is what
   lets the public bar go back to a normal 64px height and lets the dashboard and
   admin rails carry a mark at all; `HORIZONTAL_LOCKUP_SRC` in
   `src/components/layout/brand.tsx` is the single constant that switches every
   bar on the site over on delivery day.
2. **Symbol-only mark** — for the favicon, app icon, and any square avatar
   context. Needed as SVG plus PNG at 512, 192, 180, 32 and 16 px.
3. **Vector master of the current stacked lockup** — the supplied file is
   raster, so it cannot scale cleanly for print or very large displays.

Until items 1 and 2 exist:

- the browser tab uses a plain generated icon rather than a cropped logo;
- no placement derives a mark from the raster file.

## Colour note

The supplied artwork contains a subtle blue gradient. That gradient belongs to
the logo only. Interface colours are flat: no gradient buttons, headings,
backgrounds, or decorative washes anywhere in the product.
