# Brand assets still required

The supplied logo is a single raster file: `New-Era-Building-Blue-Logo.png`, a
stacked lockup with Arabic and Latin wordmarks on a white background.

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
   navigation bars where vertical space is limited. Needed as SVG. This is still
   the only thing that will put the artwork itself in a 64px bar;
   `HORIZONTAL_LOCKUP_SRC` in `src/components/layout/brand.tsx` is the single
   constant that switches every bar on the site over on delivery day.
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
