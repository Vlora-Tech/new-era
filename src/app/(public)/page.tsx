import { Benefits } from '@/components/landing/sections/benefits';
import { Catalogue } from '@/components/landing/sections/catalogue';
import { Closing } from '@/components/landing/sections/closing';
import { Demo } from '@/components/landing/sections/demo';
import { Faq } from '@/components/landing/sections/faq';
import { Features } from '@/components/landing/sections/features';
import { Hero } from '@/components/landing/sections/hero';
import { Journey } from '@/components/landing/sections/journey';
import { Products } from '@/components/landing/sections/products';

/**
 * The landing page.
 *
 * Eight bands, in the order the approved canvas sets them, each one file under
 * `src/components/landing/sections/`. This file is deliberately nothing but the
 * running order: an earlier version of this page put its whole argument inline
 * and grew to 776 lines, at which point moving a section meant moving 90 lines
 * of markup past 90 other lines of markup.
 *
 * ── What this page inherited from the canvas, and what it did not ──────────
 *
 * TAKEN AS DRAWN: the structure, the bento, the mockups, the pill nav, the
 * aurora field, the floating chips, the gradient hero, the six course cards,
 * the closing band, the copy — and the negative tracking on display type, which
 * is owner-authorised and recorded in docs/design-system.md.
 *
 * RE-TOKENISED, NOT RE-COLOURED: the canvas's palette became the product's
 * palette. `globals.css` was re-pointed to its blue ramp, its neutral ramp and
 * its type scale, so the administration area, the dashboard, checkout and the
 * exam workspace all changed with it. No component in this directory writes a
 * hex; `landing/parts.tsx` records how the canvas's ~140 literals collapsed
 * onto the scale.
 *
 * REPLACED: the canvas's icons are Material Symbols Rounded, a Google-hosted
 * webfont that `font-src 'self'` in `lib/security/csp.ts` would block outright.
 * Every glyph maps to `lucide-react` in `landing/icons.ts`.
 *
 * NOT TAKEN AS DRAWN — THE COURSE CARDS. The canvas draws six invented courses
 * with their own titles, bodies and unit counts. `Products` reads the published
 * catalogue from Prisma instead, so the homepage and `/courses` cannot disagree
 * about what exists and every card leads to a real product page. Covers come
 * from each product, falling back to the composed brand field `CourseCover`
 * already draws on the catalogue pages when an administrator has attached none.
 *
 * NOT BUILT: the canvas's `#blog` band — three article teasers, no hrefs,
 * captioned «محتوى يساعدك». The platform has no articles, and advertising a
 * reading room that does not exist is a promise this page cannot keep. The
 * canvas itself gates it behind a `showEducationalContent` flag. If a blog is
 * ever written, the band goes back between `Faq` and `Closing`.
 *
 * ALSO NOT BUILT: the fabricated address `exam.example.sa/simulator` the canvas
 * puts in the demo's URL bar. An invented domain shaped like an exam
 * authority's is exactly the confusion the independence disclaimer exists to
 * prevent, so `BrowserChrome` renders an empty pill.
 *
 * DROPPED WITH THE CANVAS: the «لماذا المنصة؟» band and the content-rights
 * band, neither of which the new artboard draws. The rights band was the only
 * one worth pausing over, and it is safe to lose here: the load-bearing
 * statement is `INDEPENDENCE_DISCLAIMER`, which still renders in the footer of
 * every public page, on `/simulators`, on `/terms`, and in the exam workspace.
 * `docs/content-and-legal-checklist.md` requires no homepage placement.
 *
 * ── What is never claimed ──────────────────────────────────────────────────
 *
 * No student count, no pass rate, no rating, no testimonial, no countdown, no
 * discount, no price. Every figure on the page — 68%, 74%, 1,240, «الدرس 4 من
 * 12» — sits inside an `aria-hidden` drawing of the product that carries a
 * visible specimen caption, and describes an imagined student.
 *
 * The six course cards in `Products` are the one band that names specific
 * things for sale. They are a prospectus, not a catalogue: no price, no
 * availability, and every card links to `/courses`, where the answer comes from
 * the database. See the note in that file.
 *
 * ── Why this route is dynamic ──────────────────────────────────────────────
 *
 * One band reads the database: `Products` lists the published courses. That is
 * the second recorded exception to the "never change a Prisma query" rule in
 * docs/design-system.md, owner-directed on 2026-08-21, and it is why
 * `force-dynamic` is declared below rather than left to inference.
 *
 * A database outage still cannot take this page down. `Products` catches its
 * own failure and removes its band; nothing else on the page touches Prisma, so
 * every other section renders exactly as it would have.
 *
 * ── One client island ──────────────────────────────────────────────────────
 *
 * `Demo` alone is `'use client'`, for the overlay that reveals the simulator
 * screen. The scroll reveals, the chart entrances, the aurora and the FAQ
 * disclosures are all CSS — `reveal`, `grow-bar`, `draw-ring`, `aurora-*` and
 * native `<details name>` — so the page renders and works completely with
 * JavaScript disabled. The canvas ships an IntersectionObserver for the reveals
 * and it is deliberately not ported.
 */
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Benefits />
      <Catalogue />
      <Demo />
      <Products />
      <Journey />
      <Faq />
      <Closing />
    </>
  );
}
