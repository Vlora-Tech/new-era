# Payments — Moyasar

Moyasar credentials were not available while this was built. The full boundary
exists and is tested against a mock that runs the identical verification and
fulfilment path, so switching to test credentials is configuration rather than
new code. What has **not** happened is a transaction against Moyasar's own test
environment; that is listed at the end.

## Configuration

| Variable                              | Notes                                                                |
| ------------------------------------- | -------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`                    | `mock` or `moyasar`. `mock` is refused when `NODE_ENV=production`.   |
| `MOYASAR_MODE`                        | `test` or `live`. Cross-checked against the key prefixes at startup. |
| `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY` | The only payment value exposed to a browser.                         |
| `MOYASAR_SECRET_KEY`                  | Server-only. Never logged, never sent to a client.                   |
| `MOYASAR_WEBHOOK_SECRET_TOKEN`        | Shared secret on the webhook envelope.                               |

Mixing a live key into test mode is rejected before the application starts, so
real cards cannot be charged against test bookkeeping.

## Keeping the mock out of production

Three independent gates, deliberately not sharing a mechanism:

1. `env()` refuses to parse `PAYMENT_PROVIDER=mock` together with production.
2. `getPaymentProvider()` refuses to return the mock adapter in production.
3. The mock completion route reads `process.env.NODE_ENV` directly and answers
   404 — indistinguishable from a route that was never deployed.

The mock does not grant anything by itself. It writes a canonical payment record
and then runs the ordinary reconciliation, with the same amount, currency and
metadata checks. Development therefore exercises fulfilment rather than bypassing
it. Its interface says `دفع تجريبي` and states plainly that no money moves.

If production is configured for Moyasar but the keys are missing, purchasing
disables itself with an Arabic availability message. It never silently grants
access.

## Checkout

1. The student picks one product. There is no cart.
2. The client generates a UUID `checkoutRequestKey` and posts it with the product
   id — **and nothing else**. Any price in the request body is ignored.
3. The server loads the published product and copies price, currency, title and
   type from the database into a new `Order`, together with an initial
   `PaymentAttempt`.
4. Repeating the same key returns the same order. Reusing it for a different
   product is rejected outright.
5. The browser receives only the approved checkout configuration.

The Moyasar form is configured explicitly rather than relying on defaults:

```js
{
  language: 'ar',
  methods: ['creditcard'],
  supported_networks: ['mada', 'visa', 'mastercard'],
  apply_coupon: false,
  metadata: { order_id, payment_attempt_id },   // opaque local references only
}
```

Metadata is deliberately minimal. The order already knows which student bought
what, so exporting a student identifier to a third party would add risk and buy
nothing.

Card details go from the browser to Moyasar directly. They never transit this
application's servers and are never logged. From `on_completed` only the payment
**id** is posted back, before any 3-D Secure redirect — which is also what makes
a lost callback recoverable, because the payment is already bound to the order.

Two things the interface says in Arabic, because both otherwise generate support
requests: the cardholder name must be at least two names in Latin characters, and
any one-time code is the bank's 3-D Secure step, not an account verification
feature this platform has.

## Verification and fulfilment

**A browser callback never grants access.** `?status=paid` is ignored entirely.

One function — `reconcilePayment` — is used by the callback, the webhook, the
scheduled sweep, the manual retry and the administrator action. Having a single
path is what stops one of them drifting into a weaker check.

1. Fetch the canonical payment from Moyasar with the server secret.
2. Locate the order through `metadata.order_id` — never through anything the
   caller supplied.
3. Lock the order row (`SELECT … FOR UPDATE`) so concurrent callers serialise.
4. Verify: payment id, amount equals the order's amount, currency is `SAR`, and
   any `payment_attempt_id` belongs to that order. A mismatch is flagged for
   review and **nothing is granted**.
5. Upsert the payment attempt, keyed on the unique provider payment id.
6. Apply the status rules, then transition the order and the entitlement in the
   same transaction.

Status handling:

| Canonical status      | Effect                                                      |
| --------------------- | ----------------------------------------------------------- |
| `paid`                | Grant access, exactly once                                  |
| `initiated`           | Awaiting 3-D Secure. No access                              |
| `authorized`          | No access — this MVP captures immediately                   |
| `captured`            | No access unless manual capture is deliberately added later |
| `failed`, `verified`  | No access                                                   |
| `refunded` (full)     | Revoke, with an appended event                              |
| `refunded` (partial)  | Record the amount, flag for review, **do not guess**        |
| `voided`              | Cancel and revoke                                           |
| anything unrecognised | Refuse, log safely, flag for review                         |

Exactly-once granting rests on three things together: the row lock, a status
guard that returns early if the order is already paid, and the unique
`(userId, productId)` constraint as the final backstop. A test fires many
simultaneous reconciles at one payment and asserts a single entitlement and a
single `GRANTED` event.

## Webhooks

`POST /api/webhooks/moyasar`, exempt from the same-origin check because it is a
machine caller authenticated by shared secret rather than by cookie.

1. Compare `secret_token` in constant time.
2. Check the envelope's live flag against the configured mode.
3. Strip the secret, minimise the payload, and dedupe on
   `(provider, providerEventId)` — falling back to a deterministic digest when
   the envelope carries no id.
4. **Commit the row, then process.** The 200 acknowledges durable receipt, not
   successful handling, so a processing failure leaves a `PENDING` row for the
   retry sweep rather than dropping the event. Nothing is left running after the
   response.
5. Re-fetch the canonical payment before changing access. The payload is a
   notification that something happened, not evidence of what.

Moyasar's documentation is inconsistent between `payment_failed` and
`payment_faild`; both are handled. Unrecognised event types are stored, logged
and acknowledged rather than retried forever.

Retries back off exponentially, capped, and give up into a `FAILED` state that
surfaces to an administrator. A claim older than five minutes is treated as
abandoned so a crashed process cannot strand an event.

## Recovery

Webhook delivery fails sometimes, and a student can close the tab mid-redirect.
Two safety nets:

- A sweep reconciles orders left pending with a payment id attached, and cancels
  ones that never got that far after 24 hours.
- A manual retry endpoint, where the payment id is **derived from an order owned
  by the signed-in student**. It accepts no payment id from the caller, so it
  cannot be used to probe arbitrary payments.

## Refunds

An administrator refund calls Moyasar and then immediately reconciles. State
always comes from the canonical fetch, never assumed from the refund response.

A full refund revokes access and appends a `REVOKED` event. A partial refund is
recorded and flagged for a human — automatically withdrawing access because some
money came back would be a guess about intent. A later repurchase reactivates and
appends `REACTIVATED`, leaving the whole history readable.

## Still required before taking real money

- [ ] Moyasar test credentials, and a real transaction through their test
      environment — including a 3-D Secure challenge, a decline, and a refund.
- [ ] Confirm in the Moyasar dashboard which event names are actually delivered.
- [ ] Register the webhook endpoint over HTTPS and verify the shared secret.
- [ ] **VAT and e-invoicing decision.** Until the client and their accountant
      document it, the order receipt is not a tax invoice and must not be
      labelled one. See [content-and-legal-checklist.md](./content-and-legal-checklist.md).
- [ ] Confirm the final refund window and conditions, and publish them.
