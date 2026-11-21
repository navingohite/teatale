# Tea Tale

A local, server-backed tea shop built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Prisma and Better Auth. It includes all 16 catalogue teas, guest checkout, private tracking, editable content and seven protected admin sections. Nothing has been deployed and no real payments were charged.

## Run locally

Use Node 22.12+ (tested with Node 26), npm and PostgreSQL 14+. Create an empty PostgreSQL database, then:

```sh
npm ci --legacy-peer-deps
cp .env.example .env
# Set DATABASE_URL and a random BETTER_AUTH_SECRET in .env.
# Example secret generator: openssl rand -hex 32
npx prisma generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3010. Do not commit .env. For a production build, run `npm run build`, then `npm start`. Runtime and build require the configured database. Run the maintenance worker once per minute (`npm run worker`) using your process supervisor/cron; it releases abandoned payment reservations and retries queued order emails.

Some newer npm installations require explicit lifecycle-script approvals. Review the Prisma engines/client and esbuild scripts before approving them. `prisma generate` is always explicit in the setup/build commands. Use the committed lockfile.

The current development database was created privately in `.local/postgres`, on loopback port 55439, database `teatale_dev`. It contains the production catalogue seed without sample prices, stock or enabled payment methods at handoff. Start it if needed with:

```sh
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D .local/postgres -l .local/postgres.log -o '-p 55439 -h 127.0.0.1 -k /private/tmp' start
```

This is a disposable development database, not a production PostgreSQL configuration. The local .env contains a generated development secret. Production must use its own database, credentials, secret and backups.

## First admin

No default admin or public registration exists. Choose a unique password of at least 12 characters and pass it through the environment:

```sh
read -r ADMIN_EMAIL
read -rs ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_PASSWORD
npm run admin:create
unset ADMIN_EMAIL ADMIN_PASSWORD
```

Sign in at `/admin/login`. The script refuses duplicate email addresses. Better Auth hashes passwords, stores database sessions, disables signup, rate-limits authentication, and supports password changes that revoke other sessions. Admin pages, product preview, artwork reads, uploads and API mutations independently check the session and admin role. Mutation routes also verify request origin. Set `BETTER_AUTH_URL` to the exact HTTPS origin in production.

## Catalogue and assets

See [the import review](docs/CATALOGUE-REVIEW.md). All names and catalogue order are preserved. Himalayan Green Tea and Himalayan Black Tea have catalogue status Available, 100 g packs and 12 months best-before from packing, but start with price and stock unset. Admin shows **Setup required**; public purchasing stays disabled. The other fourteen teas are Coming Soon with unset price, stock, weight and best-before values.

Seed upserts by an immutable catalogue ID and makes no updates to existing rows, so re-running it preserves changed slugs, SKUs, names, stock, prices and content. Product order items contain historical name, SKU, weight and price snapshots, independent of subsequent changes/archiving.

All 16 products now use the owner-supplied jar PNGs in `public/teas/jars`, matched by product slug. Original catalogue images and full poster derivatives remain in `assets/originals`, `assets/review` and `public/teas` for reference. The supplied brand logos, favicon and tea-garden story image are used throughout the storefront and admin. Home and Shop show four product cards per desktop row.

`python scripts/extract-catalogue.py /path/to/Tea_Tale_Catalogue.docx` regenerates the source JSON, transcript, images and contact sheet (requires Pillow). It does not mutate the database. The import was inspected against document table placement and the contact sheet.

Admin photo uploads accept PNG/JPEG/WebP up to 8 MB, decode and re-encode with Sharp, strip metadata, cap dimensions and use random filenames. They are stored on the server under `public/teas`; mount durable shared storage there for production and back it up. Ephemeral/serverless hosting needs an object-storage adapter before launch. Uploading creates an asset; **Save changes** publishes its association. Do not upload claim-bearing labels until approved.

## Operations

- **Dashboard:** sales, new orders, pending shipments, low stock and launch checklist.
- **Products:** searchable table with Add/Edit forms, image uploads, Preview, Publish/Unpublish, and recoverable Delete/Restore actions. Enter prices in INR; the server stores integer paise. Product status (Draft, Coming Soon, Available, Out of Stock) is separate from publication. New products stay private until Publish. Published Available products require price, weight and stock; zero stock cannot be purchased. Deleted products remain in Deleted products and restore as unpublished, preserving historical orders. Save, publish, unpublish, delete, restore, upload, password and other admin mutations use confirmation dialogs. Available product pages offer Add to Bag and Buy Now.
- **Orders:** search by number/email/name, read address and immutable items, enter courier details, ship, deliver, record collected COD, cancel eligible unpaid/unshipped orders, or request/reconcile eligible prepaid refunds.
- **Website Content:** headings, text, banner image and approval state. Draft policies are never published as accepted terms. Layout/navigation remain in code.
- **Shipping:** exact serviceable six-digit PIN list, delivery fee, optional free-shipping threshold and owner-provided estimate. No delivery promises are invented.
- **Payments:** enable configured methods and inspect transaction/refund statuses. Provider secrets are environment-only. A pending refund blocks shipping; marking Refunded requires a processed matching provider refund.
- **Settings:** store identity, public contact, featured product slugs, email configuration status, password changes and audit history.

Prices, shipping and totals are integer paise, displayed using en-IN INR formatting. Stock is available-to-sell inventory. Important mutations are audited. Queries in the admin show the most recent 100 matching orders; search narrows the result.

## Checkout and integrations

The browser bag persists in localStorage. Checkout validates an Indian phone/address/PIN, then shows a server-calculated quote. Price changes, unavailable teas, invalid quantities, duplicate lines, insufficient stock and changed totals are rejected. PostgreSQL row locks serialize stock deductions. A UUID request key plus request hash makes retries idempotent. Paid orders retain item snapshots.

Prepaid orders reserve stock for 30 minutes. Run `npm run worker` every minute; checkout also runs expiry cleanup. The same pending provider order is reused for payment retries. Failed/cancelled browser payment keeps the bag. Expired orders require a new checkout attempt. A captured payment arriving after expiry is rejected for automatic fulfilment and needs operator reconciliation/refund; alert on webhook 409s. Do not silently fulfil an expired reservation.

### Razorpay

Set `RAZORPAY_KEY_ID` to an `rzp_test_` key, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. Enable prepaid in admin. Configure `/api/webhooks/razorpay` for `payment.captured` with the same webhook secret. The app verifies callback/webhook signatures and fetches payment details server-side to check provider order, amount, INR currency and captured status. Redirects alone do not mark an order paid. Duplicate events share one stock effect and one confirmation outbox record. Refunds are provider-backed and reconciled by repeating the refund action until processed. Live keys are rejected unless `ALLOW_LIVE_PAYMENTS=true`; leave it false throughout development.

### Email and private tracking

Set `SMTP_URL` and `MAIL_FROM` on the server. Confirmation emails contain a private random-strength tracking link. Only a hash is stored on the order. Tracking without a link requires the order number plus a six-digit email code, expiring in 10 minutes with five attempts, backed by database rate limits. Successful verification consumes the code and rotates the tracking link. Public responses omit contact/address fields. Referrer policy prevents tracking tokens from being sent to outbound courier links. Treat token URLs and email queue payloads as sensitive; restrict logs and database access.

The email outbox deduplicates repeated checkout/payment events. SMTP does not offer universal exactly-once delivery: a process crash after SMTP acceptance but before marking the job sent can cause a retry. A stable Message-ID is reused. Use an email provider with idempotency support if strict crash-proof email deduplication is a launch requirement. No SMTP delivery or gateway/refund call has been verified with live credentials.

## Isolated test path

Use a dedicated database ending in `_dev`, `BETTER_AUTH_URL=http://127.0.0.1:3010`, `LOCAL_TEST_MODE=true`, and `npm run dev` (not production mode):

```sh
npx tsx scripts/local-test-fixtures.ts
npx tsx scripts/prepare-qa.ts
npx tsx scripts/verify-http.ts
```

Fixtures set the two launch teas to **sample ₹250 / 20 packs**, sample PINs 462001/462016 and sample delivery ₹50 (free at ₹1000). They never run in the production seed. The local TEST method performs no external charge. Local emails/OTP codes are written only to `.local/mail` instead of transmitted when SMTP is unset. Random QA credentials are saved privately to `.local/qa-admin.json`. The HTTP verification script requires those fixtures and the running dev server. It uses fictional `example.test` customer details.

For isolated database tests, create an empty database ending in `_test`:

```sh
DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/teatale_test' npx prisma migrate deploy
TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/teatale_test' npm test
npm run typecheck
npm run build
```

The test suite clears data only in the explicitly supplied `_test` database. Never point these commands at a store database. Remove QA accounts/fixtures or recreate the disposable development database before using it for real work.

## Verification and remaining launch work

[Verification record](docs/VERIFICATION.md) describes database, HTTP and browser checks and their limits.

Before launch, supply actual launch prices/stock; verify suppliers, geographic names, ingredients/allergens, organic/health/nutrition claims and FSSAI; approve final artwork and policies; confirm registered business/address details; configure serviceable PINs, charges, estimates, COD/prepaid, SMTP, durable uploads and scheduled worker; set a production domain/canonical origin, HTTPS and secure database/backups; create the owner admin; remove local test mode; exercise Razorpay test payments/webhooks/refunds and real email deliverability. Review data retention and operational reconciliation procedures. Deployment is intentionally not performed.

Integration references: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password), [Prisma and Better Auth](https://www.prisma.io/docs/guides/authentication/better-auth/nextjs), [Razorpay Standard Checkout](https://github.com/razorpay/markdown-docs/blob/master/payments/payment-gateway/web-integration/standard.md).

### Product pack sizes

In **Admin → Products → Edit → Pack sizes**, add weights in grams (500, 1000, 2000), with each pack’s selling price, optional MRP and stock. Save/publish confirms the change. Available products need at least one configured pack; stock zero keeps a size visible but unavailable. Existing pack weights are fixed; remove and add a size to change weight. Removing a size preserves historical orders.

Customers select a pack on the product page. Price and discount follow that size, and the bag treats different sizes as separate lines. Checkout validates the selected pack server-side and reserves only its stock. Cancellation, refund and expiry release stock back to the same pack. Product cards show the lowest available pack price as “From”. Run `npm run db:migrate` and `npx prisma generate` when updating an existing checkout.
