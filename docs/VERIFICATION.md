# Verification record

Verified locally on 20 November 2026. No deployment, real charge, or external customer email was performed.

## Automated database tests

Nine tests passed against the separate `teatale_test` PostgreSQL database:

1. Exact 16-product seed, two launch teas and fourteen Coming Soon, commercial fields unset as required.
2. Invalid quantities, malformed address, unsupported PIN, stale prices, unavailable products and insufficient stock rejected.
3. COD retries share one order, one inventory deduction and one confirmation outbox entry.
4. Two concurrent buyers compete for the last pack: exactly one succeeds and stock never becomes negative.
5. Changed final total rejects checkout without reducing stock.
6. Pending payment can retry; simultaneous duplicate completion has one confirmation effect.
7. Abandoned reservation releases stock exactly once; late payment cannot complete it.
8. Historical order items survive product edits; upcoming activation requires price, weight and stock.
9. Re-running the actual seed preserves owner-edited slug, SKU and price and does not duplicate products.

A timezone-related reservation-expiry bug was found and fixed. Dates now use PostgreSQL TIMESTAMPTZ with a migration that interprets existing Prisma timestamps as UTC.

## HTTP checks against the running application

- Unauthenticated admin mutation, admin page, original artwork and upload requests are denied; signup is disabled.
- Predictable order number alone cannot read private order data; unsigned Razorpay event is denied.
- Better Auth admin login succeeds with a temporary randomly generated test account.
- Admin can update product commercial fields, activate an upcoming tea after validation, save website content, and restore the upcoming tea.
- Guest quote and checkout succeed with the explicitly isolated fixtures. Invalid PIN is rejected.
- Retry uses the same pending order; duplicate local payment completion has one outbox entry.
- Private order response omits email/address. Local confirmation email is generated.
- Wrong OTP is rejected; correct OTP is consumed and rotates access; previous link no longer works; repeated requests are rate-limited.
- All 15 public page templates and all 16 product URLs returned HTTP 200.
- Public shop response excludes the private catalogue-origin/benefit fields.
- Authenticated upload decodes and stores a WebP; anonymous upload and unsupported content are rejected. The temporary upload was removed.

## Browser checks

Desktop home and shop were inspected. Tea-type filtering showed the two herbal infusions. Product detail showed the correct label crop and brewing data. At a mobile-size viewport, Add to Bag worked, the bag survived refresh, guest checkout displayed an unsupported-PIN error, then displayed the server-calculated ₹250 sample subtotal plus ₹50 sample delivery. Choosing the clearly labelled local test method produced a PAID confirmation without a customer account and emptied the bag. Screenshots are retained as `qa-desktop-home.jpg` and `qa-mobile-order.jpg`.

The browser's viewport control was scaled by the host surface; the observed effective widths were approximately 1025 px desktop and 391 px mobile. No horizontal document overflow was observed. This was a focused responsive review, not an exhaustive device/accessibility audit.

## Build and handoff

TypeScript checking and the Next.js optimized production build passed. Production seed restoration removes temporary QA accounts, orders and inventory from the disposable development database; LOCAL_TEST_MODE is disabled at handoff. Test databases and ignored local test email files remain separate from production source/seed. No default admin credentials are shipped.

## Unverified external behaviour and operational limits

Razorpay test credentials and SMTP credentials were not supplied, so actual provider checkout, captured-payment retrieval, signed provider delivery/retry, refund processing and external email deliverability are unverified. The local test method verifies the app's transaction/idempotency path; it does not substitute for gateway acceptance tests.

The worker must be scheduled at least once a minute. Late captured payments after reservation expiry require manual reconciliation. SMTP crash recovery can resend the same Message-ID after the provider accepts a message but before the database marks it sent; the outbox prevents duplicates caused by repeated checkout/payment events, not this distributed-system crash window.

Uploads use the server filesystem and require a persistent/shared volume; ephemeral hosting needs a storage adapter. Courier details are entered by admins, not fetched from a courier API. Refund automation is limited to unshipped captured prepaid orders. Other return/refund decisions require the owner's approved policy and manual handling.

Before launch, review the business-input checklist in README.md and CATALOGUE-REVIEW.md. This verification does not constitute approval of pricing, stock, policies, sourcing, certification or label claims.
