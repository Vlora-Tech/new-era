import { Catalogue } from '@/components/landing/sections/catalogue';
import { Closing } from '@/components/landing/sections/closing';
import { Demo } from '@/components/landing/sections/demo';
import { Faq } from '@/components/landing/sections/faq';
import { Features } from '@/components/landing/sections/features';
import { Hero } from '@/components/landing/sections/hero';
import { Journey } from '@/components/landing/sections/journey';
import { Method } from '@/components/landing/sections/method';
import { Products } from '@/components/landing/sections/products';
import { Rights } from '@/components/landing/sections/rights';
import { Why } from '@/components/landing/sections/why';

/**
 * The landing page.
 *
 * Eleven bands, in the order the approved design sets them, each one file under
 * `src/components/landing/sections/`. This file is deliberately nothing but the
 * running order: the previous page put its whole argument inline and grew to 776
 * lines, at which point moving a section meant moving 90 lines of markup past 90
 * other lines of markup.
 *
 * ── What this page inherited from the design, and what it did not ──────────
 *
 * TAKEN AS DRAWN: the structure, the bento, the mockups, the pill nav, the
 * floating chips, the gradient hero, the closing band, the copy.
 *
 * RE-COLOURED: the design ran indigo into violet. Every gradient here runs the
 * platform's own brand blue into its teal accent, from the `--neb-gradient-*`
 * tokens. No component writes a hex.
 *
 * REPLACED: the design's placeholder mark — a 42px gradient tile with an «ع» in
 * it — is the real lockup, carried by the header bar and the footer through
 * `components/layout/brand.tsx`. The drawn in-product bar inside the hero uses
 * `BrandWordmark`, the set-type mark, because the supplied artwork may not be
 * shown below 220px or on a tinted ground.
 *
 * ALSO REPLACED: the design's icons are Material Symbols Rounded, a
 * Google-hosted webfont that `font-src 'self'` in `lib/security/csp.ts` would
 * block outright. Every glyph maps to `lucide-react` in `landing/icons.ts`.
 *
 * NOT BUILT: the design's `#blog` band — three article teasers, no hrefs,
 * captioned «محتوى يساعدك». The platform has no articles, and advertising a
 * reading room that does not exist is a promise this page cannot keep. The
 * design itself gates it behind a `showEducationalContent` flag. If a blog is
 * ever written, the band goes back between `Faq` and `Closing`.
 *
 * ALSO NOT BUILT: the fabricated address `exam.example.sa/simulator` the design
 * put in the demo's URL bar. An invented domain shaped like an exam authority's
 * is exactly the confusion the independence disclaimer exists to prevent, so
 * `BrowserChrome` renders an empty pill.
 *
 * ── What is never claimed ──────────────────────────────────────────────────
 *
 * No student count, no pass rate, no rating, no testimonial, no countdown, no
 * discount, no price. Every figure on the page — 68%, 74%, 1,240, «الدرس 4 من
 * 12» — sits inside an `aria-hidden` drawing of the product that carries a
 * visible specimen caption, and describes an imagined student. Prices are on
 * the catalogue pages, where they come from the database.
 *
 * ── Why this is a static page now ──────────────────────────────────────────
 *
 * The page it replaced was `force-dynamic` and queried Prisma for four featured
 * products to fill a ledger band. The new design has no ledger, so the query and
 * the dynamic flag are gone — recorded as the one sanctioned exception to the
 * "never change a Prisma query" rule in docs/design-system.md. The route is not
 * fully static in practice, because `(public)/layout.tsx` still awaits
 * `getCurrentUser()` to decide what the header shows; what was actually gained
 * is that a database outage can no longer degrade the marketing page. Live
 * catalogue data is one click away in either product card.
 *
 * ── One client island ──────────────────────────────────────────────────────
 *
 * `Demo` alone is `'use client'`, for the overlay that reveals the simulator
 * screen. The scroll reveals, the chart entrances and the FAQ disclosures are
 * all CSS — `reveal`, `grow-bar`, `draw-ring` and native `<details name>` — so
 * the page renders and works completely with JavaScript disabled.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Method />
      <Catalogue />
      <Why />
      <Demo />
      <Products />
      <Journey />
      <Rights />
      <Faq />
      <Closing />
    </>
  );
}
