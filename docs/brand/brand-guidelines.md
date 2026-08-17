# New Era Building

## Digital brand and light-platform guidelines

Version 1.0 — based on the approved blue logo

## 1. Brand direction

New Era Building should feel established, precise, dependable, and quietly modern. The visual system should borrow from good architecture: a strong grid, deliberate spacing, honest materials, and a clear hierarchy.

The platform must feel designed by people for real work. It should not resemble a generic AI startup, speculative technology product, or template filled with decorative effects.

**Brand traits:**

- Dependable, not loud
- Contemporary, not futuristic
- Professional, not cold
- Structured, not rigid
- Confident, not promotional

**Light theme only:** do not create a dark theme, dark page sections, a theme toggle, or alternate dark component tokens.

## 2. Logo usage

Use the approved `New-Era-Building-Blue-Logo.png` without altering its proportions, colors, language lockup, or internal spacing.

- Use the complete logo on a pure white background. The current PNG has a white background, so it should not be placed on tinted panels or photography.
- Keep clear space around it equal to at least 12% of the logo width.
- Use the full stacked logo at 220 px wide or larger whenever its Arabic and English text must remain readable.
- Do not stretch, recolor, rotate, outline, crop, mask, or add another shadow.
- Do not extract the upper symbol by cropping this PNG. Commission an approved mark-only or horizontal lockup for compact navigation, favicons, and app icons.
- Until a compact asset exists, use the full logo only in placements with enough vertical space, such as the sign-in screen, sidebar, footer, loading screen, and presentation pages.

## 3. Color system

The two principal blues below were sampled from the supplied logo. Interface colors are deliberately flat; the logo itself is the only place where its blue gradient should appear.

| Role             | Token         |       Hex | Use                                                   |
| ---------------- | ------------- | --------: | ----------------------------------------------------- |
| Deep brand blue  | `brand-700`   | `#1066A4` | Primary buttons, links, active navigation, key icons  |
| Brand blue       | `brand-500`   | `#2686C8` | Logo-aligned accents, large icons, charts, highlights |
| Blue tint        | `brand-100`   | `#EAF4FA` | Selected rows and informational panels                |
| Strong blue tint | `brand-200`   | `#D5EAF6` | Tags and subtle highlights                            |
| Main text        | `ink-900`     | `#16232D` | Headings and primary text                             |
| Body text        | `ink-700`     | `#52616B` | Paragraphs and descriptions                           |
| Muted text       | `ink-600`     | `#64727C` | Metadata and secondary labels                         |
| Border           | `line-200`    | `#D7E0E5` | Dividers, cards, and table lines                      |
| Strong border    | `line-500`    | `#8798A3` | Form fields and essential control boundaries          |
| Canvas           | `surface-050` | `#F5F6F4` | Warm stone page background                            |
| Surface          | `surface-000` | `#FFFFFF` | Navigation, forms, cards, main content                |

Recommended distribution: 70% white, 18% light neutrals, 8% deep blue, and no more than 4% bright brand blue.

Accessibility notes:

- `#1066A4` with white has approximately 6.1:1 contrast and is suitable for normal-size button text.
- `#2686C8` with white has approximately 3.9:1 contrast. Do not use this pairing for normal-size text; reserve it for large text, graphics, or accents.
- Do not use color alone to communicate status. Pair it with text and, where useful, an icon.
- Use visible focus rings and meet WCAG AA contrast throughout.

Suggested semantic colors should remain secondary to the brand: success `#247A4A`, warning `#8A5A0A`, and error `#B33A3A`, each with a very pale matching background.

## 4. Typography and bilingual behavior

Use the IBM Plex family for a sober, engineered tone and reliable Arabic/English pairing.

- English: `IBM Plex Sans`
- Arabic: `IBM Plex Sans Arabic`
- Body: 400
- Buttons and labels: 500
- Headings: 600; use 700 sparingly
- Avoid 800–900 weights, decorative display faces, and condensed all-cap headings

Recommended type scale:

| Role    |  Desktop |   Mobile |
| ------- | -------: | -------: |
| Display | 48/58 px | 36/46 px |
| H1      | 40/50 px | 32/41 px |
| H2      | 30/40 px | 26/35 px |
| H3      | 22/31 px | 20/29 px |
| Body    | 16/26 px | 16/26 px |
| Small   | 14/22 px | 14/22 px |
| Caption | 12/18 px | 12/18 px |

Use sentence case for headings, buttons, and navigation. Never add letter spacing to Arabic. Keep English paragraphs near 65–75 characters per line. Arabic interfaces must use true RTL layout: mirror the grid, alignment, navigation order, directional icons, and field relationships rather than only right-aligning the text.

## 5. Layout and spacing

- Desktop: 12-column grid; tablet: 8 columns; mobile: 4 columns.
- Maximum content width: 1280 px.
- Page gutters: 32 px desktop, 24 px tablet, 16 px mobile.
- Base spacing unit: 8 px. Preferred steps: 4, 8, 12, 16, 24, 32, 48, 64, 80, 96.
- Section spacing: 72–96 px desktop and 48–64 px mobile.
- Give each screen one obvious focal point and one primary action.
- Favor editorial, slightly asymmetric compositions over a sequence of centered sections.
- Use full-width dividers, aligned edges, and restrained white space to create structure.
- Use cards only when content genuinely needs grouping. Structured information belongs in lists or tables, not a wall of identical cards.

## 6. Component language

**Navigation**

- White surface with a 1 px bottom border.
- Use deep blue for the active item; do not use glowing or floating navigation.
- Keep primary navigation to approximately five top-level choices.

**Buttons**

- Primary: `#1066A4` background, white label, 6–8 px radius.
- Hover: `#0C568C`; active: `#08436F`.
- Secondary: white background, deep-blue label, 1 px deep-blue border.
- Tertiary: text only, used for low-priority actions.
- Use specific verbs such as “View project,” “Submit request,” or “Save changes,” not vague labels such as “Explore now.”

**Cards and panels**

- White background, 1 px `#D7E0E5` border, 8–12 px radius.
- No shadow by default. Use a light shadow only for menus, dialogs, and temporary overlays.
- Do not make ordinary cards or buttons pill-shaped; reserve pills for short tags and statuses.

**Forms**

- Persistent labels above fields; never rely on placeholders as labels.
- White field background, visible border, and 44–48 px minimum control height.
- Show clear focus, error, success, disabled, and read-only states.
- Keep validation language direct and useful.

**Tables and data views**

- Prefer calm row separators and generous cell padding over boxed cells.
- Use the blue tint for selection and the deep blue for the active control.
- Keep status colors small and labeled.

## 7. Imagery and iconography

Use real project photography whenever possible: buildings, sites, materials, drawings, details, and people doing credible work. Favor natural daylight, accurate perspective, restrained color correction, and consistent rectangular crops.

Architectural elements such as plans, structural lines, steel, concrete, glass, and measured grids may appear as subtle motifs. They should support the content rather than become decoration.

Avoid generic skylines, staged handshakes, smiling stock teams, fake 3D buildings, holographic dashboards, visibly synthetic AI imagery, and text over busy photographs.

Use one geometric outline icon family at 20–24 px with a consistent 1.75–2 px stroke. Do not mix outline, filled, emoji, illustrated, and 3D icons.

## 8. Motion

- Use 160–220 ms ease-out transitions for hover, disclosure, menus, and state changes.
- Respect `prefers-reduced-motion`.
- Avoid parallax, scroll hijacking, pulsing glows, floating objects, looping decorations, and theatrical page entrances.

## 9. Rules that prevent the “AI website” look

Do:

- Use strong alignment, real content, flat surfaces, concise factual writing, and restrained blue accents.
- Let typography, photography, dividers, and composition create hierarchy.
- Use occasional full-width editorial sections instead of repeating the same component grid.
- Show only real metrics, projects, testimonials, and certifications.

Do not:

- Use mesh gradients, gradient text, neon blue glows, glassmorphism, or blurred color blobs.
- Build every section as a rounded “bento” card grid.
- Center every heading or use oversized slogans with little information.
- Add floating dashboard mockups, decorative charts, random icons, or fake data.
- Repeat identical three-column feature sections.
- Use clichés such as “reimagining the future,” “unlocking limitless possibilities,” or “where innovation meets excellence.”
- Invent client logos, statistics, reviews, certifications, projects, or platform capabilities.

## 10. Page direction

For public or marketing pages, use a structured two-column hero with a short factual heading, one supporting paragraph, one primary action, and one real project image. Follow it with only verified proof, clear service or project information, and a direct contact path.

For the authenticated platform, use a stable sidebar or top navigation, a clear page title, one primary action, and task-focused lists, tables, forms, and detail panels. Do not present routine operational data as a marketing dashboard full of cards.

## 11. Light-only implementation tokens

```css
:root {
  color-scheme: light;

  --neb-brand-700: #1066a4;
  --neb-brand-500: #2686c8;
  --neb-brand-hover: #0c568c;
  --neb-brand-active: #08436f;
  --neb-brand-100: #eaf4fa;
  --neb-brand-200: #d5eaf6;

  --neb-text-primary: #16232d;
  --neb-text-secondary: #52616b;
  --neb-text-muted: #64727c;
  --neb-border: #d7e0e5;
  --neb-border-strong: #8798a3;
  --neb-canvas: #f5f6f4;
  --neb-surface-muted: #eef2f3;
  --neb-surface: #ffffff;

  --neb-success: #247a4a;
  --neb-warning: #8a5a0a;
  --neb-error: #b33a3a;

  --neb-radius-control: 8px;
  --neb-radius-panel: 10px;
  --neb-focus: 0 0 0 3px rgba(38, 134, 200, 0.28);
  --neb-shadow-overlay: 0 12px 32px rgba(22, 35, 45, 0.12);
}
```

Also set `<meta name="color-scheme" content="light">`. Do not add dark-mode media queries or a theme switcher.

## 12. Copy-ready generation brief

Generate a production-quality, light-only web platform for New Era Building. The brand should feel established, architectural, dependable, precise, and human—never futuristic or like a generic AI-generated website. Use the supplied New Era Building blue logo unchanged on white. Use IBM Plex Sans for English and IBM Plex Sans Arabic for Arabic, with genuine RTL behavior.

Use `#1066A4` for accessible primary actions, `#2686C8` only as a restrained accent, `#EAF4FA` for selected or informational surfaces, `#16232D` for primary text, `#52616B` for body text, `#D7E0E5` for dividers, `#8798A3` for form borders, `#F5F6F4` for the warm page canvas, and white for main surfaces. Keep 85–90% of the interface white or neutral. Use flat interface colors; keep the gradient inside the logo only.

Build on a disciplined responsive grid with strong alignment, 8 px spacing logic, 6–12 px corner radii, thin borders, and almost no shadows. Use lists and tables for structured data and cards only for genuinely separate objects. Give each screen one focal point and one primary action. Use real project and construction photography with natural light and accurate materials.

Do not create dark mode or dark sections. Do not use gradient text, mesh gradients, neon glows, glassmorphism, floating blobs, excessive pills, bento-grid repetition, oversized centered slogans, fake statistics, decorative charts, 3D icons, generic AI copy, or invented content. Include complete hover, focus, active, disabled, empty, loading, error, and success states. Meet WCAG AA and keep touch targets at least 44 px.

Platform scope and required pages: **[replace this line with the real platform purpose, users, pages, and actions before generation]**.

## 13. Final review checklist

- Light theme only; no theme control or dark sections
- Supplied logo is unchanged and sits on white
- Deep blue is used for accessible actions; bright blue is an accent
- English and Arabic typography and direction are correct
- One clear focal point and primary action per screen
- Real content and imagery; no invented proof
- Few cards, minimal shadows, restrained radii
- No AI-style gradients, glass, blobs, glows, or vague copy
- Keyboard focus, contrast, touch targets, and reduced motion are covered
- Desktop, tablet, mobile, LTR, and RTL layouts have been tested
