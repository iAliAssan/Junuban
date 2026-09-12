# Junubân — Implementation Status

> Read this file first at the start of every cycle, before writing any code.
> The repository is the source of truth — never assume prior chat context.

Last updated: Cycle 4 (Commerce Core — Checkout, Orders, Payment foundation)

## Current phase

**Phase 3 → 4: Commerce Core is implemented.** A shopper (guest or
authenticated) can now go from cart → checkout → a real order with
server-authoritative pricing, atomic inventory reservation, and an
honest (non-fake) payment-pending state for manual transfer methods.
Still no Admin Panel, real payment gateway, reviews, or customer order
history UI beyond the backend endpoints — correctly out of scope per
this cycle's instructions.

## Audit at the start of this session

Per this session's explicit instruction, the repository was inspected
before continuing. Found: the orders module (schema audit, all utils,
`OrdersService`/`OrdersController`/`OrdersModule`, DTOs, payment
abstraction, and their tests) was already fully written from an earlier
part of this cycle, plus a real improvement to `PrismaService`
(replacing a fragile `Parameters<>`-extraction + `as any` cast with
Prisma's own `Prisma.TransactionClient` type). **None of it had been
verified yet** (no syntax sweep, no import check), and **the entire
frontend checkout flow was missing** — that was the actual remaining
work, completed this session.

## Schema: no changes needed

Cycle 1 already modeled everything this cycle needed: `Order`,
`OrderItem` (with full snapshot fields), `OrderStatusHistory`,
`PaymentAttempt` (including `REQUIRES_CONFIRMATION`/manual-confirmation
fields), `InventoryReservation`, `Address`. This cycle only added
**service logic** on top of an already-correct schema — confirmed by
re-reading the schema in full before writing any code, per this cycle's
explicit audit-first instruction. Brace/model-count integrity re-checked
(unchanged, 29 models).

## Completed this cycle

### Backend (`apps/api/src/orders`)
- **`order-status.util.ts`** (pure, tested — 8 cases): valid transition
  table. Uses the schema's existing `PENDING_PAYMENT` as the entry state
  rather than introducing a redundant `PENDING` + `PAYMENT_PENDING` pair
  — the Cycle 4 prompt's suggested state list was explicitly "a
  reasonable foundation," and the instruction to "inspect the current
  repository first" and "not blindly introduce duplicate/conflicting
  statuses" pointed at preserving the locked schema default instead.
- **`shipping.util.ts`** (pure, tested — 4 cases): flat-rate + optional
  free-shipping-threshold, reusing the exact config shape already
  defined in `configuration.ts` since Cycle 1 (`shipping.flatRateToman`
  etc.) rather than inventing a second shipping config surface.
- **`order-number.util.ts`** (pure, tested): human-readable
  `JB-YYYYMMDD-XXXXXX` format; uniqueness is enforced by the service via
  a small collision-retry loop against the DB (a pure function alone
  can't guarantee global uniqueness).
- **`money.util.ts`** (pure, tested): thousands-separator formatting for
  plain-text payment instructions — a backend-side counterpart to the
  frontend's existing Persian-digit formatter, not a duplicate of it
  (different output: no digit-locale conversion needed server-side).
- **Payment abstraction** (`payment/payment-provider.ts` +
  `payment-provider.factory.ts`): `PaymentProvider` interface with
  `initiate`/`verify`. `ManualTransferPaymentProvider` is a **real,
  functioning** implementation for CARD_TO_CARD/SHEBA — these need no
  gateway at all, since manual bank transfer + human confirmation is a
  legitimate payment method in its own right, not a mock of one. It
  includes the exact amount to transfer (a real gap caught and fixed
  during this session — the initial version accepted `amount` but never
  used it in the instructions text). `UnconfiguredOnlinePaymentProvider`
  exists for the `ONLINE` method but throws clearly rather than faking
  a working gateway; `ONLINE` is deliberately **not offered** as a
  selectable checkout option yet (`CHECKOUT_AVAILABLE_PAYMENT_METHODS =
  ["CARD_TO_CARD", "SHEBA"]`), both at the DTO validation level and in
  the frontend's payment-method radio group.
- **`OrdersService.checkout`** — the transactional core:
  1. Idempotent replay: an existing order for the same
     `checkoutIdempotencyKey` is returned as-is rather than duplicated.
  2. Guest checkout requires `guestPhone`; authenticated checkout does not.
  3. Loads the *live* cart via the existing, already-tested
     `CartService.getCart` (reused, not reimplemented) and rejects if
     empty or if any line already shows `hasAvailabilityIssue`.
  4. Computes `subtotal`/`shippingCost`/`total` server-side —
     **the client cannot submit or influence any monetary value.**
  5. Inside `PrismaService.runSerializable` (Serializable isolation,
     retried on Postgres serialization failures): re-validates each
     variant is still active, re-reads live inventory, rejects if
     insufficient, then atomically increments
     `Inventory.reservedGrams` by `weightGrams × quantity` (never a
     per-kg formula) — concurrent checkouts racing for the same stock
     are caught by Postgres's serialization-failure detection rather
     than a hand-written compare-and-swap.
  6. Creates the `Order` + `OrderItem`s with full snapshots
     (`productNameSnapshot`, `unitPriceSnapshot`, etc.) taken from the
     cart view — historically correct even if the product/price changes
     later.
  7. Creates `InventoryReservation` rows with the existing 15-minute TTL
     (`AppConfig.inventory.reservationTtlMinutes`, unchanged from
     Cycle 1 — the existing worker job from Cycle 1 already sweeps and
     releases these on expiry; no new expiry logic was needed).
  8. Creates the initial `OrderStatusHistory` row and a `PaymentAttempt`
     (`REQUIRES_CONFIRMATION` for manual methods).
  9. Clears the cart in the same transaction.
  - All monetary values are plain integers (Toman) throughout — no
    floating-point arithmetic anywhere in the checkout path.
- **`OrdersService.markOrderPaid`** — consumes reservations (decrements
  both `onHandGrams` and `reservedGrams`, marks reservation `CONSUMED`),
  transitions the order to `PAID` (validated against
  `order-status.util`), and marks the matching `PaymentAttempt`
  `SUCCEEDED`. **Deliberately not wired to a public HTTP endpoint yet**
  — seem "Explicitly NOT done" below for why.
- **`OrdersService.cancelOrder`** — releases active reservations back to
  available stock, ownership-checked, transition-validated.
- **`OrdersController`**: `POST /checkout` (guest or authenticated, cart
  identity resolved the same way `CartController` already does — no
  second auth mechanism introduced), `GET /orders` and
  `GET /orders/:orderId` (both `CustomerSessionGuard`-protected,
  ownership-checked — a customer can never fetch another customer's
  order), `POST /orders/:orderId/cancel`.
- **`orders.service.spec.ts`** (20 cases) against hand-mocked
  Prisma/Cart/Config/Payment dependencies: empty-cart rejection,
  availability rejection, guest-phone requirement, idempotent replay,
  live in-transaction availability re-check (distinct from the earlier
  cart-level check), exact-gram reservation math, snapshot-field
  correctness, cart clearing, manual-payment-attempt creation,
  ownership checks (404 vs 403 distinguished), status-transition
  rejection, reservation consumption/release math.

### A real fix made along the way: `PrismaService.runSerializable`
While reviewing the transaction helper this cycle now depends on
heavily, found it used a fragile `Parameters<PrismaClient["$transaction"]>[0]`
type-extraction (which relies on TypeScript's undocumented behavior for
overloaded function types) plus an `as any` cast to work around it —
inherited from Cycle 1 as a known shortcut. Replaced with
`Prisma.TransactionClient`, Prisma's own exported type for exactly this
callback shape. Removes the unsafe cast entirely rather than propagating
it into new code, per this cycle's explicit "do not hide errors with
unsafe casts" instruction.

### Frontend (`apps/web`)
- **`lib/checkout-client.ts`**: browser-side fetch client (same
  `credentials: 'include'` pattern as `cart-client.ts`, for the same
  reason — the API's cookies need to flow through the browser
  natively).
- **`lib/checkout-validation.ts`** (pure, tested — 10 cases): client-side
  mirror of the server's `CheckoutDto` rules, for immediate inline
  feedback only — the server remains the authoritative validator.
- **`lib/auth-client.ts`**: minimal `getCurrentCustomer()` check (calls
  the existing `GET /auth/me`) — checkout needs to know whether to show
  the guest-contact fields, and there was no client-side way to know
  auth status before this.
- **`/checkout`** page: address form (all fields mirrored from
  `ShippingAddressDto`), guest-contact fields (shown only when not
  authenticated), payment method selection (CARD_TO_CARD/SHEBA only —
  matches the backend's `CHECKOUT_AVAILABLE_PAYMENT_METHODS` exactly, so
  nothing offered here could be rejected by the API), a
  client-generated-once idempotency key (persisted in component state
  across retries within the page session), real loading/submitting/error
  states, and double-submission prevention. On success, shows an inline
  confirmation with the **real order total from the server response**
  (not the pre-submission cart total, which excludes shipping — see the
  gap fixed below) and the manual-transfer instructions, under a clearly
  labeled "در انتظار تایید پرداخت" (awaiting payment confirmation) state
  — never a fake success screen.
- **`/cart`**: the Cycle-3 "checkout coming soon" note is now a real
  `/checkout` link (disabled with an explanatory message instead, when
  any line has an unresolved availability issue).

### Two real gaps found and fixed during this session (not just new code — actual bugs caught before they shipped)
1. **`ManualTransferPaymentProvider.initiate()` accepted an `amount`
   parameter but never used it** — the payment instructions shown to the
   customer would have said "transfer the amount" without ever stating
   what the amount was. Fixed to include the formatted total.
2. **`CheckoutDto.shippingAddress` was missing `@ValidateNested()` +
   `@Type(() => ShippingAddressDto)`** — without these, class-validator
   does not descend into a nested object's own decorators at all, so
   every field-level rule on `ShippingAddressDto` (required recipient
   name, phone format, 10-digit postal code, etc.) would have silently
   never run, accepting any object shape. Caught by re-reading the DTO
   before moving on, not by a test (this class of gap doesn't fail
   TypeScript's type-checker — the shape is still valid TS, just wrong
   at runtime — worth remembering for future DTOs with nested objects).
3. Also caught and fixed a **frontend-only UX correctness gap**: the
   checkout page's pre-submission order summary showed `cart.total`
   (which, per Cycle 3's Cart implementation, deliberately excludes
   shipping) as if it were the final amount, but the actual order the
   server creates includes `shippingCost`. Fixed by showing subtotal
   plus an honest "shipping will be added" note pre-submission, and the
   real, authoritative total breakdown only on the post-submission
   confirmation screen where it's backed by real server data.

## Explicitly NOT done yet (do not assume otherwise)

- **No admin-facing payment-confirmation endpoint.** `markOrderPaid` is
  fully implemented and tested as domain logic, but intentionally not
  exposed on a public controller route. Real payment confirmation must
  come from a trusted source; for manual transfers that's an
  authenticated admin action, and admin authentication (Argon2id
  password login, Owner/Staff roles) was defined in the Cycle 1 schema
  but never built as actual guards/endpoints — building that properly is
  a meaningful feature in its own right and was explicitly out of scope
  this cycle ("do not build the full Admin dashboard"). Wiring
  `markOrderPaid` behind real admin auth is the natural next step once
  that exists.
- **No `ONLINE` payment gateway integration** — deliberately not
  attempted; `UnconfiguredOnlinePaymentProvider` documents this and
  fails loudly rather than pretending. Real gateway credentials
  (ZarinPal or similar) are an external blocker only the user can supply.
- **No customer-facing order-history page** (`/account/orders` or
  similar) — the backend (`GET /orders`, `GET /orders/:id`) is ready, but
  building the account-area UI around it wasn't explicit checkout-flow
  scope this cycle and risks the "do not over-design yet" instruction.
  Reasonable next-cycle item.
- **No guest order tracking by order-number lookup** — a guest's
  confirmation is shown inline immediately after checkout (using the
  direct API response), but there's no way for a guest to look up that
  order again later without an account. Documented as a deliberate scope
  boundary, not an oversight.
- Minor, non-bug inefficiency: `OrdersController.checkout` validates the
  session cookie once via `CartContextService.resolveCart` (internally)
  and once more directly (to extract `customerId`) — two DB round-trips
  for session validation instead of one. Left as-is rather than
  restructuring `CartContextService`'s return shape under this cycle's
  time budget; worth consolidating later if it shows up as a real
  performance concern.

## Verification actually performed this session

**Performed and passed:**
- Full-repo `tsc --noResolve` syntax sweep (102 TypeScript/TSX files
  across both apps) — zero new real errors. Three flagged lines total,
  all previously-diagnosed `--noResolve`-only artifacts (unresolvable
  imports breaking `instanceof` narrowing in this synthetic check mode
  only): `http-exception.filter.ts`, `cart-provider.tsx` (both
  pre-existing, reconfirmed), and one new instance in
  `checkout-page-client.tsx` which was independently re-verified this
  session to compile cleanly once `CheckoutApiError`'s real type
  resolves (same scratch-repro methodology used since Cycle 3).
- Import-resolution check: 46 web files, 54 api files, all resolve.
- CSS Module class-reference audit: 31 tsx files, all `styles.X`
  references match their CSS module's actual defined classes.
- Targeted `tsc --strict --noUncheckedIndexedAccess` on every new
  dependency-free pure file (`order-status.util.ts`, `shipping.util.ts`,
  `order-number.util.ts`, `money.util.ts`, `checkout-validation.ts`,
  `checkout-client.ts`) — zero issues.
- Manual grep audit of `orders.service.ts`/`orders.controller.ts`/
  payment files for the array-indexing bug pattern found in Cycle 3 —
  zero instances (this module doesn't do array indexing of that shape).
- Regression re-check of every Cycle 1–3 safeguard explicitly called out
  by this cycle's checklist: Header portal (`createPortal` present),
  `tokens.css` import path, `sitemap.ts`'s network-failure-safe
  `instanceof ApiError` handling, `apiGet`'s network-error wrapping,
  `FilterPanel`/`SortMenu` presence — all intact, none touched this
  session.
- Prisma schema brace/model-count integrity (unchanged, 29 models).
- No Wishlist reintroduction (one text match, confirmed to be a code
  comment documenting the exclusion, not functionality).

**NOT performed (same standing constraint, now spanning all four
cycles):** `npm install`/`pnpm install`, `prisma generate`/`validate`,
`next build`, `nest build`, running the Jest suites for real, `eslint`,
any real browser rendering. This sandbox has never had outbound network
access. **This is now the single highest-priority item for whoever
continues this project** — every cycle's verification has been
static-analysis-only; a real install+build+test run would very likely
surface things this method structurally cannot see (real Next.js/NestJS
type augmentations, actual Prisma client shape, real class-validator
nested-DTO behavior, nested transaction typing under the real
`@prisma/client` types).

## Blockers that genuinely require the user

Unchanged from Cycle 3 (SMS gateway, real payment gateway, card-to-card/
Sheba destination account details for `.env`, cart cookie domain/
SameSite strategy for production) — plus: a decision on when/how to
build admin authentication, since `markOrderPaid`'s real trigger depends
on it.

## Next cycle should do (in order)

1. **A real `npm install` + `npm run dev` is now the single most
   overdue item across five cycles.**
2. Admin authentication (Argon2id login, Owner/Staff guards) — this
   unlocks wiring `markOrderPaid` to a real endpoint, which is the
   actual missing link between "order placed" and "order fulfilled" in
   the current implementation.
3. Customer-facing order history page using the already-built
   `GET /orders`/`GET /orders/:id`.
4. Real payment gateway integration for `ONLINE`, if/when credentials
   are available.
5. Cart cookie domain/SameSite decision (carried over, still not
   blocking anything functionally, but should be resolved before any
   production deployment).
