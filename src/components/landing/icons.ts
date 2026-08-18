/**
 * The landing page's icon set.
 *
 * The approved design specifies Material Symbols Rounded, which is a
 * Google-hosted webfont. It cannot ship: `src/lib/security/csp.ts` sets
 * `font-src 'self'`, so the browser would block it outright and
 * `tests/e2e/security-headers.spec.ts` would catch it — and self-hosting a
 * variable icon font for one marketing page is ~400 KB to render forty glyphs
 * the product already has in `lucide-react`.
 *
 * So every Material glyph is mapped to its nearest lucide equivalent, here, in
 * one file. Two reasons for the indirection rather than importing lucide names
 * directly in twenty components:
 *
 *   1. The mapping is a design decision and belongs somewhere reviewable
 *      against the artboard. Ten of these are near-matches, not exact ones.
 *   2. lucide renames icons between majors — `PlayCircle` → `CirclePlay`,
 *      `HelpCircle` → `CircleQuestionMark`, `CheckCircle` → `CircleCheck` all
 *      changed in v1. When the next rename lands, this is the only file to fix.
 *
 * Naming is semantic (`IconRights`, not `IconShieldCheck`) so a future swap of
 * the underlying glyph does not require touching a call site.
 *
 * Sizing convention at the call sites: `size-4` for 14–16px glyphs, `size-5`
 * for 18–21px, `size-6` for 23–26px. Anything `size-6` or larger takes
 * `strokeWidth={1.75}`, because lucide's default 2px stroke reads heavier than
 * Material's rounded weight-400 at display sizes.
 */
export {
  // ── Section eyebrows ──────────────────────────────────────────────────────
  Zap as IconBadge, // bolt          — hero badge
  LayoutGrid as IconFeatures, // grid_view     — §features
  TrendingUp as IconMethod, // insights      — §method, §why feature card
  BookOpen as IconCourses, // menu_book     — §courses, resume tile
  Timer as IconTimer, // timer         — §simulators, every exam clock
  Award as IconWhy, // workspace_premium — §why
  CirclePlay as IconDemo, // play_circle   — §demo, lesson rows
  ShoppingBag as IconProducts, // shopping_bag  — §products
  Route as IconJourney, // route         — §journey
  CircleQuestionMark as IconFaq, // help          — §faq

  // ── Method and why ────────────────────────────────────────────────────────
  GraduationCap as IconLearn, // school
  SquarePen as IconPractice, // edit_note
  ShieldCheck as IconRights, // verified_user — §why card, §rights seal
  Languages as IconArabic, // translate
  BookmarkCheck as IconSaved, // bookmark_added
  ChartColumn as IconResults, // bar_chart

  // ── Checks and status ─────────────────────────────────────────────────────
  CircleCheck as IconCheck, // check_circle  — every checklist
  Check as IconTick, // check         — module list
  CircleCheckBig as IconVerified, // task_alt      — rights status, stat tile
  CloudCheck as IconAutosave, // cloud_done    — autosave chips
  Lock as IconLocked, // lock
  LockOpen as IconUnlocked, // lock_open
  History as IconHistory, // history
  MonitorSmartphone as IconDevices, // devices
  Infinity as IconPermanent, // all_inclusive

  // ── Product chrome inside the mockups ─────────────────────────────────────
  Play as IconPlay, // play_arrow
  Search as IconSearch, // search
  Bell as IconBell, // notifications
  Plus as IconPlus, // add
  ChevronDown as IconChevron, // expand_more   — FAQ marker, dropdown chips
  CircleDot as IconSelected, // radio_button_checked
  ClipboardList as IconQuiz, // quiz
  Info as IconInfo, // info

  // Forward is LEFT in RTL — see the hard rule in docs/design-system.md.
  ArrowLeft as IconForward, // arrow_back

  // ── Float chips ───────────────────────────────────────────────────────────
  Speech as IconVerbal, // record_voice_over
  Calculator as IconQuantitative, // calculate
  RotateCcw as IconAttempts, // replay
  TrendingUp as IconImprovement, // trending_up

  // ── Footer ────────────────────────────────────────────────────────────────
  Mail as IconMail, // mail
} from 'lucide-react';
