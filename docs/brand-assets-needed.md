# Brand assets still required

The supplied logo is a single raster file: `New-Era-Building-Blue-Logo.png`, a
stacked lockup with Arabic and Latin wordmarks on a white background.

The brand guidelines state that it must not be cropped, recoloured, stretched,
rotated, masked, or have the upper symbol extracted from it, and that it should
be used at 220px wide or more so both wordmarks stay legible. They also say that
a compact mark should be **commissioned**, not improvised from this file.

## What the platform does today

| Placement                     | Mark used                                                                   | Why                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public header                 | Typographic wordmark (`نيو إيرا`, set in IBM Plex Sans Arabic, `brand-700`) | A slim header bar is roughly 64px tall. The supplied lockup needs 220px of width and proportional height to stay legible, and cropping it to fit is explicitly forbidden. Set type is not a derived logo, so it breaches nothing. |
| Dashboard and admin rails     | Typographic wordmark                                                        | Same constraint.                                                                                                                                                                                                                  |
| Sign-in and registration card | Full logo, ≥220px, on white, with 12% clear space                           | There is vertical room, and the page benefits from the real mark.                                                                                                                                                                 |
| Public footer                 | Full logo, ≥220px, on white                                                 | Same.                                                                                                                                                                                                                             |

## Assets to commission

1. **Horizontal lockup** — symbol beside the wordmark, for headers and
   navigation bars where vertical space is limited. Needed as SVG.
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
