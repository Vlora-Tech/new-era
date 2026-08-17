import 'server-only';

import type { PaymentStatus } from '@prisma/client';

/**
 * Provider payment statuses, and what each one is allowed to do to access.
 *
 * Moyasar reports a lowercase string. Mapping it to the `PaymentStatus` enum in
 * exactly one place means a status the platform has never seen cannot quietly
 * fall through a `switch` and be treated as "not paid yet" — it throws, the
 * reconcile is recorded as unresolved, and a human looks at it.
 *
 * The access rules are deliberately conservative. Only a `paid` payment opens a
 * product. Every intermediate state — an authorisation, a verification, a
 * capture — leaves access closed, because none of them is settled money. A
 * partial refund never withdraws access automatically: deciding how much
 * product a partial refund buys is a commercial judgement, not a state machine.
 */

/** Thrown when the provider reports a status this application does not model. */
export class UnknownPaymentStatusError extends Error {
  readonly rawStatus: string;

  constructor(rawStatus: string) {
    super(`Unrecognised provider payment status: ${JSON.stringify(rawStatus)}`);
    this.name = 'UnknownPaymentStatusError';
    this.rawStatus = rawStatus;
  }
}

/**
 * Every status Moyasar documents, lowercase as it appears on the wire.
 * `CREATED` is absent on purpose: it is a local status for an attempt row that
 * has not yet reached the provider, so it can never arrive from one.
 */
const RAW_STATUS_MAP = {
  initiated: 'INITIATED',
  paid: 'PAID',
  failed: 'FAILED',
  authorized: 'AUTHORIZED',
  captured: 'CAPTURED',
  verified: 'VERIFIED',
  refunded: 'REFUNDED',
  voided: 'VOIDED',
} as const satisfies Record<string, PaymentStatus>;

export type RawPaymentStatus = keyof typeof RAW_STATUS_MAP;

export function normalizePaymentStatus(rawStatus: string): PaymentStatus {
  const key = rawStatus.trim().toLowerCase();
  const mapped = RAW_STATUS_MAP[key as RawPaymentStatus];
  if (!mapped) throw new UnknownPaymentStatusError(rawStatus);
  return mapped;
}

/** True when the string is a status this application knows how to handle. */
export function isKnownPaymentStatus(rawStatus: string): boolean {
  return rawStatus.trim().toLowerCase() in RAW_STATUS_MAP;
}

// ── Access rules ─────────────────────────────────────────────────────────

/**
 * What a status does to entitlement, before the refunded amount is considered.
 *
 * `REVOKE_IF_FULLY_REFUNDED` exists because `refunded` is the only status whose
 * meaning depends on an amount: the same status covers "all the money went back"
 * and "some of it did", and only the first is an unambiguous withdrawal.
 */
export type AccessRule = 'GRANT' | 'NONE' | 'REVOKE' | 'REVOKE_IF_FULLY_REFUNDED';

export const ACCESS_RULES = {
  CREATED: 'NONE',
  INITIATED: 'NONE',
  AUTHORIZED: 'NONE',
  VERIFIED: 'NONE',
  CAPTURED: 'NONE',
  PAID: 'GRANT',
  FAILED: 'NONE',
  REFUNDED: 'REVOKE_IF_FULLY_REFUNDED',
  // A void cancels the transaction outright; there is no partial void.
  VOIDED: 'REVOKE',
} as const satisfies Record<PaymentStatus, AccessRule>;

export type RefundKind = 'NONE' | 'PARTIAL' | 'FULL';

/** Classify how much of a payment has been returned. Integer halalas only. */
export function classifyRefund(amountHalalas: number, refundedHalalas: number): RefundKind {
  if (refundedHalalas <= 0) return 'NONE';
  // A provider that reports more refunded than charged is still a full return.
  if (refundedHalalas >= amountHalalas) return 'FULL';
  return 'PARTIAL';
}

export type AccessDecision = {
  /** What reconciliation should do to the entitlement. */
  access: 'GRANT' | 'NONE' | 'REVOKE';
  /** Whether the outcome needs a human decision before anything else happens. */
  needsReview: boolean;
  /** Why review was requested, for the audit trail. Null when none is needed. */
  reviewReason: string | null;
};

/**
 * Combine a status with the refunded amount into a single access decision.
 *
 * The two flagged cases are both "money moved in a way a state machine should
 * not resolve on its own": a payment that still reads as paid while part of it
 * has been returned, and a payment marked refunded with nothing recorded as
 * returned.
 */
export function decideAccess(
  status: PaymentStatus,
  amountHalalas: number,
  refundedHalalas: number,
): AccessDecision {
  const rule = ACCESS_RULES[status];
  const refund = classifyRefund(amountHalalas, refundedHalalas);

  if (rule === 'GRANT') {
    if (refund === 'PARTIAL') {
      return { access: 'GRANT', needsReview: true, reviewReason: 'partial_refund_on_paid' };
    }
    if (refund === 'FULL') {
      // Paid and fully returned at once: settle it by hand rather than guess
      // which of the two facts is the later one.
      return { access: 'NONE', needsReview: true, reviewReason: 'full_refund_on_paid' };
    }
    return { access: 'GRANT', needsReview: false, reviewReason: null };
  }

  if (rule === 'REVOKE') {
    return { access: 'REVOKE', needsReview: false, reviewReason: null };
  }

  if (rule === 'REVOKE_IF_FULLY_REFUNDED') {
    if (refund === 'FULL') return { access: 'REVOKE', needsReview: false, reviewReason: null };
    if (refund === 'PARTIAL') {
      return { access: 'NONE', needsReview: true, reviewReason: 'partial_refund' };
    }
    return { access: 'NONE', needsReview: true, reviewReason: 'refunded_without_amount' };
  }

  return { access: 'NONE', needsReview: false, reviewReason: null };
}
