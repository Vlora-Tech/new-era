/** Shared, non-secret constants. Safe to import from client components. */

export const AUTH = {
  /** Session cookie name. */
  COOKIE_NAME: 'ne_session',
  /** Minimum acceptable length for the session signing secret. */
  MIN_SECRET_LENGTH: 32,
  /** bcrypt cost factor. */
  PASSWORD_ROUNDS: 12,
  MIN_PASSWORD_LENGTH: 8,
  /** Administrators created through the bootstrap CLI face a stricter rule. */
  MIN_ADMIN_PASSWORD_LENGTH: 10,
} as const;

export const ROUTES = {
  home: '/',
  courses: '/courses',
  simulators: '/simulators',
  login: '/login',
  register: '/register',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  refundPolicy: '/refund-policy',
  dashboard: '/dashboard',
  dashboardCourses: '/dashboard/courses',
  dashboardSimulators: '/dashboard/simulators',
  dashboardAttempts: '/dashboard/attempts',
  dashboardOrders: '/dashboard/orders',
  dashboardAccount: '/dashboard/account',
  admin: '/admin',
} as const;

/**
 * Route prefixes the proxy performs an optimistic session check on.
 *
 * Every page under these prefixes also guards itself, because the proxy cannot
 * see whether an account was blocked. Listing a prefix here only saves a
 * signed-out visitor from loading a page that would immediately redirect them.
 */
export const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/learn',
  '/exam',
  '/checkout',
] as const;

export const VIDEO = {
  /** Default share of a video that must be watched before completion. */
  DEFAULT_COMPLETION_THRESHOLD_PERCENT: 90,
  /** Client heartbeat interval while a video is playing. */
  PROGRESS_HEARTBEAT_SECONDS: 15,
  /**
   * Ceiling on how fast watched time may grow relative to real elapsed time.
   * Bunny's fastest playback is 2x; the margin absorbs scheduling jitter.
   */
  MAX_PLAYBACK_RATE: 2.25,
} as const;

export const EXAM = {
  /** Client autosave debounce. */
  AUTOSAVE_DEBOUNCE_MS: 600,
  /** Countdown warnings, in seconds remaining. */
  TIMER_WARNING_SECONDS: [300, 60],
} as const;

/** Legal document versions currently in force; recorded against each consent. */
export const LEGAL_VERSION_KEYS = {
  terms: 'legal.termsVersion',
  privacy: 'legal.privacyVersion',
} as const;
