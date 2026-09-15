# Junubân — Implementation Status

> Read this file first at the start of every cycle, before writing any code.
> The repository is the source of truth — never assume prior chat context.

Last updated: Cycle 10 (Motion Polish + Demo Data Expansion + Regression Audit)

## Cycle 10 — Motion Polish + Demo Data Expansion + Regression Audit

### Scope note (read this before assuming anything is unfinished)

Cycle 10's own prompt asked for a very large slate of work: a full
UI/UX upgrade across the entire app, a complete animation system,
6–10 demo products, and a full regression re-verification of Cycle 9's
build/auth/env fixes. Per the master prompt's own governing rules
(§27 "do NOT attempt to implement the entire project in one response",
§30 "make reasonable engineering decisions yourself"), this cycle
deliberately scoped down to a concrete, verifiable slice rather than
making shallow, unverifiable edits across dozens of files. What was
inspected vs. what was changed are reported separately below so the
next cycle can tell the difference.

### Regression audit performed first (per this cycle's own §9–11)

Before writing any UI code, the three specific regressions Cycle 10's
prompt worried about were checked directly against source:

1. **`useSearchParams()` Suspense boundary at `/admin/login`**
   (`apps/web/src/app/admin/login/page.tsx`) — **confirmed still
   correctly fixed**. `AdminLoginPageClient` is wrapped in
   `<Suspense fallback={null}>`, matching the pattern documented in
   Cycle 9. No regression found; no change made.

2. **Hardcoded `localhost` URLs in production** — grepped the entire
   repo for `localhost:3000` / `localhost:4000`. Every single
   occurrence (12 call sites across `apps/web/src/lib/*-client.ts`,
   `apps/web/src/app/**`, `apps/api/src/config/configuration.ts`,
   `apps/api/src/main.ts`) is a `??` fallback that only applies when
   the real environment variable (`NEXT_PUBLIC_API_URL`, `API_URL`,
   `APP_URL`) is unset. This is the correct, safe pattern — **no code
   change needed**. What this *cannot* verify from this sandbox is
   whether the Vercel project's environment variables are actually
   set; that is an infrastructure/deployment check the user needs to
   confirm in the Vercel dashboard, not something fixable in source.

3. **"ارتباط با سرور برقرار نشد" generic error masking** — read
   `apps/web/src/lib/admin-auth-client.ts` end to end. This message is
   thrown **only** when the `fetch()` call itself throws (a real
   network/DNS/CORS failure reaching the API host at all). Any HTTP
   response that comes back — 401 invalid credentials, 403 disabled
   account, 429 rate limited, 500 server error — has its real
   backend-authored `message` field surfaced to the user instead,
   exactly as Cycle 10 required. **This is not the bug described; it
   was already fixed** (most likely during Cycle 8, uncredited in that
   cycle's own notes). No change made — the working code was left
   alone rather than "fixed" a second time.

### Sandbox constraint (unchanged, now 10 cycles running)

Confirmed again this session: `curl` to `registry.npmjs.org` returns
`403` with header `x-deny-reason: host_not_allowed`. No outbound
network access exists in this sandbox, so `npm install`, real
`next build`, `nest build`, and `eslint` remain impossible here, same
as every prior cycle. **New this cycle**: a standalone `tsc` binary
(TypeScript 6.0.3) is available on `PATH` without needing network
access or the project's own `node_modules`. This was used for real —
not just brace-counting — type-checking of every file this cycle
touched, using hand-written minimal stub `.d.ts` files for
`@prisma/client`, `argon2`, `react`, `react/jsx-runtime`, and
`next/navigation` (same technique Cycle 8 pioneered for its admin
frontend). **Result: zero type errors** in `prisma/seed.ts` (verified
against realistic `PrismaClient`/`argon2` stub shapes) and zero errors
in `cart-line-item.tsx` under `strict: true` against real React/Next
type shapes. This is a stronger verification signal than any previous
cycle achieved, but is still not a substitute for the project's own
`tsc --noEmit` / `next build` against its real dependency tree — that
remains the single most valuable next action for whoever has real
network access.

### What was changed this cycle

**1. Motion token system (new)** — `apps/web/src/styles/tokens.css`
gained a small set of centralized motion tokens: `--ease-standard`,
`--ease-out`, `--ease-in`, `--ease-spring`, and
`--duration-instant/fast/base/slow` (120/180/240/320ms). Previously
every component's transition duration was a hand-picked literal
(mostly already landing in a sensible 120–300ms range from prior
cycles, per Cycle 8's "restrained animation" note) with no shared
vocabulary. This does not change how any *existing, untouched*
component currently feels — only new/edited rules reference the new
tokens.

**2. Demo product data expanded from 6 → 10 products**
(`apps/api/prisma/seed.ts`), per this cycle's explicit request for
"around 6–10 realistic Southern Iranian products" including coffee,
honey, dried fish, and pickle. Added, using the exact same idempotent
`upsert`-based `seedProduct()` helper already established in Cycle 9
(no parallel seeding mechanism introduced):
- `southern-arabic-coffee` (قهوه عربی جنوبی) — 1 producer, 2 weights.
- `sidr-honey` (عسل کنار) — 1 producer, 2 weights, premium pricing.
- `dried-fish` (ماهی خشک) — 1 producer, 1 weight, intentionally
  low-stock (2000g on hand ÷ 500g package = exactly 4 packages left,
  exercising the same low-stock UI path as the existing saffron
  product but for a different product shape).
- `bandari-pickle` (ترشی بندری) — **2 producers**, 2 weights, added
  specifically to give the producer-selector UI a second exercised
  product beyond the existing مضافتی date (the master prompt's core
  Product→Producer→ProductProducer relationship needs more than one
  worked example in seed data to be properly testable).
  All four use the existing `spices` category — the locked category
  set (`dates`, `spices`, `handicrafts`, `gift-boxes`) has no honey/
  coffee/seafood category, and inventing one is a real data-model
  decision, not a seed-script detail, so it was deliberately not made
  unilaterally. If a dedicated category is wanted, that's a decision
  for the user to make explicitly, not something this cycle should
  guess at.
  Two new producers added to back these products with plausible
  provenance, following the existing producer-bio style exactly:
  `chabahar-fishers-co` (تعاونی صیادان چابهار) and
  `bushehr-coast-kitchen` (آشپزخانه ساحلی بوشهر — supplies both the
  honey and the pickle, which is realistic for a small coastal kitchen
  producer rather than one producer per product).
  Verified via isolated `tsc` type-check (see above) — not just a
  visual read-through.

**3. Targeted animation/interaction polish** — added only where a
real, already-wired interactive element had zero transition coverage
(audited every `.module.css` file in `apps/web/src` for
`transition`/`animation`/`@keyframes` presence first, rather than
guessing which files needed it):
- `variant-selector.module.css` — add-to-cart feedback message now has
  a real entrance animation (`feedback-in`, 180ms) instead of popping
  in instantly; add-to-cart button gets `:active` press feedback
  (scale 0.97).
- `quantity-stepper.module.css` — +/− buttons get `:active` press
  feedback (scale 0.9). The `aria-live="polite"` value span was
  deliberately left untouched — animating it on every increment would
  fight with screen-reader announcement timing, consistent with
  Cycle 9's own documented accessibility reasoning for a similar case.
- `cart-line-item.module.css` + `.tsx` — the line item now dims
  (opacity 0.55) while a quantity-change or remove mutation is in
  flight, via a new `data-busy` attribute actually wired from the
  component's existing `busy` state (verified this isn't orphaned
  CSS — the attribute is real and reflects real state). Remove button
  gets a proper color/background transition instead of an instant
  color snap.
- `admin-dashboard.module.css` — the one real, working dashboard card
  (linking to Orders) gets a hover lift (`translateY(-2px)` +
  shadow). Deliberately scoped with `:has(.cardLink)` so the "not
  available yet" placeholder card does **not** get the same hover
  treatment — it has no working link, and giving it the same
  affordance as a real card would be exactly the "fake functionality"
  the master prompt forbids (§26).
- `admin-shell.module.css` — sidebar/drawer nav-link transition
  updated to use the new motion tokens (functionally the same
  120ms→instant-token duration, now centrally controlled).
- `admin-orders-page.module.css` — table rows get a subtle background
  tint on hover. Deliberately *not* styled as if the whole row is
  clickable (only the "detail" cell is a real link) — an honest
  scan-line highlight, not a misleading affordance.
- `admin-login-page.module.css` — form error message gets a real
  entrance animation instead of popping in instantly; submit button
  gets `:active` press feedback; text inputs get a smooth
  border/shadow transition on focus instead of an instant snap.
  (Caught and fixed a self-introduced duplicate `.field input` block
  during editing — verified clean afterward.)
- `pagination.module.css` — page links get a proper hover transition
  (border/background/color) instead of an instant snap.

All new animation/transition rules are covered by the pre-existing
global `prefers-reduced-motion` rule in `tokens.css` (which sets
`animation-duration`/`transition-duration` to near-zero for everyone
regardless of per-component rules), and the two new bespoke
`@keyframes` (`feedback-in`, `admin-form-error-in`) additionally have
explicit `@media (prefers-reduced-motion: reduce) { animation: none }`
overrides, matching the belt-and-suspenders pattern Cycle 9 already
established for the admin drawer.

### What was audited but deliberately NOT changed

- **Admin drawer/scrim animations, skeleton shimmer loaders, page
  fade-in** (`admin-shell.module.css`, `admin-orders-page.module.css`,
  `globals.css`) — already well-built with correct reduced-motion
  handling from Cycles 8–9. Re-verified, left alone. Re-animating
  already-correct code would just be churn.
- **Header dropdowns, filter panel, sort menu, catalog grid, hero,
  category rail, producer strip, utility bar** — these already have
  some transition coverage from prior cycles (confirmed via the same
  grep audit) and were not touched this cycle; a deeper pass on these
  is reasonable next-cycle work if more animation coverage is wanted,
  but this cycle prioritized finishing what it started (seed data +
  the highest-traffic zero-coverage files) over spreading thin across
  every remaining file.
- **Full UI/UX visual redesign** (stronger hierarchy, card redesigns,
  new empty/loading/error state designs across the whole app) — this
  cycle's prompt asked for this at a scale (§1 of the Cycle 10 prompt)
  that cannot be responsibly done as unverified, un-buildable edits in
  one session. The existing visual system (Cycles 1–9) already
  implements the locked design tokens, restrained animation
  philosophy, and real loading/empty/error states per component — see
  prior cycle notes above for what already exists. **Recommended as a
  dedicated next-cycle focus**, ideally with real `next build`/browser
  verification available, rather than continuing to layer unverified
  visual changes on top of each other.
- **Product detail page structural changes** — already has a real
  gallery, variant selector, weight/producer selection, and
  availability states from prior cycles (confirmed via source read).
  Not restructured this cycle; the new demo products (multi-weight,
  multi-producer `bandari-pickle` especially) now give it more
  realistic data to actually exercise those existing states.

### Verification actually performed this session

**Performed and passed:**
- Confirmed (again) no outbound network access: `curl` to
  `registry.npmjs.org` → `403`, `x-deny-reason: host_not_allowed`.
- Real isolated `tsc --strict` type-check (TypeScript 6.0.3, present
  on `PATH` without network access) of `apps/api/prisma/seed.ts`
  against hand-written `@prisma/client`/`argon2` stub types — **zero
  errors**, including all 4 new products' data shapes.
- Real isolated `tsc --strict` type-check of the edited
  `cart-line-item.tsx` (plus its `quantity-stepper.tsx` dependency and
  `cart-client.ts`/`format.ts` imports) against hand-written
  `react`/`react/jsx-runtime`/`next/navigation`/`next/image`/
  `next/link` stub types — **zero errors**, including the new
  `data-busy={busy}` prop.
- Comment/string-aware brace-balance check (not naive counting — an
  earlier naive attempt this session gave a nonsense unbalanced result
  because it didn't strip comments/strings first; re-done properly)
  across all 9 CSS/CSS-module files touched this cycle — all balanced.
- Duplicate-top-level-selector scan across the same 9 files — caught
  and fixed one real self-introduced duplicate (`.field input` in
  `admin-login-page.module.css`, from an editing mistake mid-session,
  found and corrected before this report was written, then
  re-verified clean). The other three flagged "duplicates" were
  confirmed false positives on manual inspection (a legitimate
  `@media` responsive override re-declaring `.imageWrap`, a
  `@keyframes` block's `to {}` inner selector, and a legitimate
  `@media (prefers-reduced-motion: reduce)` override re-declaring
  `.submitButton:active:not(:disabled)`).
- Manually re-verified the `data-busy` attribute is actually wired
  from real component state (`data-busy={busy}` in `.tsx`) before
  claiming the corresponding CSS rule as real functionality — this
  check exists specifically because it's easy to add CSS that
  silently does nothing, which the master prompt explicitly forbids
  as a category of fake functionality (§26).

**NOT performed** (same standing constraint as every prior cycle):
`npm install`, `next build`, `nest build`, `next lint`, real Jest/
Playwright execution, actual browser rendering at any viewport,
`prisma generate`/`migrate` against a real database, Docker build
validation. **This is now the single most overdue item across 10
cycles** and should be the very first action of whichever session has
real network/build access — ideally before any further UI work is
layered on top of 10 cycles of static-analysis-only verification.

### Final report (per this cycle's requested format)

**1. Files changed:** 10 — `apps/web/src/styles/tokens.css` (motion
tokens added); `apps/api/prisma/seed.ts` (4 new products, 2 new
producers); `apps/web/src/components/variant-selector/
variant-selector.module.css`; `apps/web/src/components/cart/
quantity-stepper.module.css`; `apps/web/src/components/cart/
cart-line-item.module.css` + `cart-line-item.tsx`;
`apps/web/src/app/admin/admin-dashboard.module.css`;
`apps/web/src/components/admin/admin-shell.module.css`;
`apps/web/src/app/admin/orders/admin-orders-page.module.css`;
`apps/web/src/app/admin/login/admin-login-page.module.css`;
`apps/web/src/components/pagination/pagination.module.css`.

**2. Major UI/UX improvements:** entrance animations for add-to-cart
feedback and admin login form errors; press feedback on primary
buttons and quantity controls; real (state-wired, not decorative)
busy-dimming on in-flight cart line mutations; honest hover treatments
on the one real admin dashboard card and admin order table rows;
smoother focus/hover transitions on pagination and login form inputs.

**3. Animation system added:** a centralized motion-token layer
(`--ease-*`, `--duration-*`) in `tokens.css`, consumed by all of this
cycle's new/edited transition and animation rules. All motion respects
the pre-existing global `prefers-reduced-motion` rule, with explicit
per-keyframe overrides for the two new bespoke `@keyframes` blocks.

**4. Demo data added:** 4 new products (10 total), 2 new producers,
all idempotent/upsert-based, matching the existing seed pattern
exactly. `bandari-pickle` specifically gives the multi-producer
selector UI a second real exercise case beyond the pre-existing
مضافتی date.

**5. Admin improvements:** dashboard card hover feedback (scoped to
only the real, working card), order table row hover, nav-link
transition centralization, login form polish (error entrance
animation, submit button press feedback, input focus transition) —
no structural or business-logic changes to the admin auth/session
architecture, which was audited and confirmed intact, not modified.

**6. Database/auth checks:** admin session architecture
(`AdminUser`/`AdminSession`/Argon2id/`junuban_admin_session`) read and
confirmed unchanged and untouched this cycle. `DATABASE_URL` usage in
`apps/api/prisma/schema.prisma` confirmed to still come from
`env("DATABASE_URL")` with no hardcoded fallback — this cycle made no
Prisma schema changes, so no new migration is required for the seed
data additions (they use existing models only).

**7. Build result:** not run (no network access in this sandbox,
unchanged since Cycle 1). Real isolated `tsc --strict` checks passed
for all touched `.ts`/`.tsx` logic (see verification section) — this
is a genuine, if partial, correctness signal, not a substitute for the
project's own `next build`/`nest build`. **The user should run a real
`npm install && npm run build` locally or on Vercel before treating
this cycle's changes as fully verified**, exactly as every prior
cycle has recommended.

**8. Known issues / remaining work for Cycle 11:**
- Real `npm install`/build/test execution — 10 cycles overdue, the
  single highest-priority item.
- Confirm Vercel project environment variables
  (`NEXT_PUBLIC_API_URL`, `API_URL`, `APP_URL`, `DATABASE_URL`) are
  actually set in the Vercel dashboard — this cycle confirmed the
  *code* has safe fallbacks, but cannot verify the *deployment
  configuration* itself.
- Broader animation coverage for header dropdowns, filter panel, sort
  menu, catalog grid, hero, category rail, producer strip, and utility
  bar — audited this cycle (confirmed they already have some coverage
  from prior cycles) but not deepened further.
- The larger structural UI/UX redesign requested by Cycle 10's prompt
  (§1) — deliberately deferred to a session with real build
  verification available, per this cycle's scope note above.
- Admin CRUD for products/producers/inventory — still blocked on
  missing backend endpoints, unchanged since Cycles 8–9.

## Cycle 9 — Production Build Fix + Scope Audit

### Scope note


Cycle 9's prompt asked for a large slate of work (admin CRUD for
products/producers/inventory, storefront polish, an animation system,
a full responsive/accessibility audit) but made the Vercel production
build fix a hard, explicit blocking prerequisite ("Cycle 9 must not be
considered complete while the production build is failing"). This
session prioritized that fix and a full verification audit around it
first, exactly as instructed, rather than spreading effort thin across
the rest of the list. See "What was NOT done" below for why the CRUD
portions of the prompt were not attempted.

### Priority 1 — Production build fix (done)

**Root cause, confirmed by reading source, not guessed:**
`apps/web/src/app/admin/login/page.tsx` rendered `AdminLoginPageClient`
directly with no `Suspense` boundary. `AdminLoginPageClient` (`admin-
login-page-client.tsx`) calls `useSearchParams()` (to read an optional
`?redirect=` target) — a Client Component hook that opts the whole
subtree out of static prerendering unless wrapped in `<Suspense>`,
which is exactly the Vercel error in the prompt (`useSearchParams()
should be wrapped in a suspense boundary at page "/admin/login"`).

The customer-facing equivalent, `app/(storefront)/account/login/
page.tsx`, already had the correct pattern (`<Suspense fallback=
{null}}><LoginPageClient /></Suspense>`) — it was only the admin
login page that was missing it, most likely because it was added in
Cycle 8 without noticing the existing storefront precedent.

**Fix applied** (smallest correct change, matches the existing
storefront pattern exactly, no behavior change): wrapped
`AdminLoginPageClient` in `admin/login/page.tsx` with `<Suspense
fallback={null}>`. Nothing in `admin-login-page-client.tsx` itself
changed — the `redirect` query param, the session-check redirect, the
login form, and all existing error handling are untouched.

**Audit of every other `useSearchParams()` usage in the repo** (per
the prompt's explicit instruction not to assume `/admin/login` is the
only occurrence): grepped `apps/web/src` for `useSearchParams(` —
exactly two matches existed: `account/login/login-page-client.tsx`
(already correctly wrapped) and `admin/login/admin-login-page-client.
tsx` (the one just fixed). No other occurrences anywhere in the app.
Also checked every other `next/navigation` import in the repo
(`useRouter`, `usePathname`, `redirect`, `notFound`, plus the
server-component `searchParams` prop used by `search/page.tsx` and
`category/[categorySlug]/page.tsx`) — none of those require a
`Suspense` boundary for static generation, so none were touched.

**Build verification — honestly reported:** this sandbox still has no
outbound network access (confirmed again this session: `npm install`
against `apps/web` returned `403 Forbidden` from the npm registry, the
same standing constraint noted in every cycle since Cycle 1), so
`npm run build` / `next build` could not actually be executed here.
What *was* run and passed: a repo-wide `tsc --noEmit --noResolve`
syntax sweep across all 73 `apps/web/src` `.ts`/`.tsx` files (zero new
errors beyond the already-known `--noResolve`-only import-resolution
noise, which is expected without `node_modules` and was excluded), and
a manual re-read of the fixed file and its one consumer. The actual
`next build` execution — which is the only thing that can fully
confirm the Vercel prerender error is gone — is the single most
important next action for whoever has real network/build access,
exactly as flagged in every previous cycle's report.

### Priority 2–4 — Admin dashboard / product / order management: not touched this cycle, and why

Re-verified against source before doing anything else (per the
prompt's own step 1–7 "inspect first" instructions):
- `/admin`, `/admin/login`, `/admin/orders`, `/admin/orders/[orderId]`,
  and `/admin/activity-log` already exist and are real, backend-
  connected pages built in Cycle 8 — not rebuilt or duplicated this
  cycle.
- Grepped `apps/api/src/**/*.controller.ts` again: the only admin
  controllers are still `admin/auth`, `admin/orders`, and `admin/
  activity-log`. There is still no admin API for products, producers,
  weight options, variants, or inventory — only the public read-only
  `catalog.controller.ts`. This is unchanged since Cycle 8's audit.
- Per the master prompt's own repeated instruction ("do NOT add fake
  statistics/buttons/CRUD that don't work"), building a Product/
  Producer/Inventory admin UI this cycle would mean fabricating
  against endpoints that don't exist. That work stays blocked until a
  future cycle adds the backend admin endpoints for those resources —
  this is a backend-scope gap, not a frontend-effort gap.

### What was NOT done this cycle (and why)

Storefront UI/UX polish, the animation system, and the full responsive
/accessibility audit (Priorities 5–7) were not attempted this session.
Given the prompt's own stated priority order and its explicit framing
of the build failure as a hard blocking acceptance criterion, this
session's effort went entirely into fixing that failure correctly and
verifying it thoroughly (including the full-repo audit for the same
class of bug) rather than starting broad UI work against a repository
that was, at the start of this session, in a non-shippable state.
**Recommended as the very next cycle's focus**, now that the build
blocker is resolved.

**5. Blocked by backend/database/API (unchanged from Cycle 8):**
admin CRUD for products/producers/inventory (no backend endpoints),
content pages (no serving endpoint), producer detail pages (no
endpoint), guest order tracking (no endpoint), real payment gateway
(no credentials).

**6. Recommended next cycle:** (1) get this fix verified with a real
`next build` on actual infrastructure — that's the only way to fully
close Cycle 9's own acceptance criterion; (2) if backend admin
endpoints for products/producers/inventory are added, build that UI
next; (3) otherwise, proceed to Priorities 5–7 (storefront polish,
animation, responsive/accessibility audit) against the now-fixed
repository.

## Cycle 8 — Admin Frontend

### Scope note

Cycle 8's own prompt was explicit: build the first real Admin Frontend
and connect it to Cycle 7's backend, without rebuilding that backend.
No ZIP was re-uploaded for this cycle, so this cycle continued directly
from the in-session repository state left at the end of Cycle 7 (same
conversation) — per the standing rule ("Repository فعلی منبع حقیقت
است"), that in-session state is the current source of truth, not the
older Cycle 6 ZIP still sitting in uploads.

### Audit performed before writing any frontend code

Read every real Cycle 7 admin controller/DTO directly from source
(`admin-auth.controller.ts`, `admin-orders.controller.ts`,
`activity-log.controller.ts`, and their DTOs) rather than relying on
this conversation's earlier description of them. Confirmed exactly:
- `POST /api/v1/admin/auth/login` — body `{ email, password }`, sets an
  **httpOnly** cookie server-side (`junuban_admin_session`), returns
  `{ admin: { id, email, fullName, role } }`. Because the cookie is
  httpOnly, the frontend has no token to read or store — this
  eliminated any temptation to reach for localStorage, by construction.
- `GET /api/v1/admin/auth/me`, `POST /api/v1/admin/auth/logout` — both
  guarded, both consumed as-is.
- `GET/POST /api/v1/admin/orders...` — list (paginated, `status`
  filter), get-by-id, `POST :orderId/mark-paid`. Guarded by
  `AdminSessionGuard` only (**no** `AdminOwnerGuard`) — confirmed by
  reading the controller's `@UseGuards` decorator directly, which is
  why the mark-paid button in the UI is available to STAFF as well as
  OWNER, not gated client-side.
- `GET /api/v1/admin/activity-log` — guarded by **both**
  `AdminSessionGuard` and `AdminOwnerGuard`. Confirmed this means a
  STAFF admin gets a real 403 from the API; the frontend handles that
  as an honest "owner only" state, not a silent hide or a redirect.
- Grepped every controller file in `apps/api/src/**`: confirmed there
  is still **no** admin API for products, categories, producers, or
  inventory (only public read-only `catalog.controller.ts` endpoints
  exist for those). Per the master prompt's explicit rule ("route یا
  صفحه‌ای که Backend/Frontend capability آن هنوز وجود ندارد را fake و
  clickable نساز"), **no CRUD UI, no nav entries, and no dead-end
  routes were built for any of these** — they're absent from
  navigation entirely, not present-but-disabled, and the dashboard
  says so in plain Persian rather than showing fabricated stats.

### Architectural decision: route group restructuring (real, not cosmetic)

`/admin` needed a genuinely independent layout (no storefront
Header/Footer/CartProvider) per the prompt's "Admin layout مستقل"
requirement. Next.js App Router's root layout wraps every nested route
unconditionally — there is no path-based opt-out from a single root
layout. The documented, correct mechanism for "a section with a
completely different UI" is multiple root layouts via route groups
(verified against Next.js's own docs before proceeding, not assumed).

**What changed:** every existing storefront route (`account/`, `cart/`,
`category/`, `checkout/`, `orders/`, `producers/`, `products/`,
`search/`, `page.tsx`, `layout.tsx`) moved into a new
`app/(storefront)/` route group — a pure file move, zero URL changes,
since route groups are invisible in the URL. `robots.ts` and
`sitemap.ts` deliberately stayed at the `app/` root (Next.js requires
`robots.ts` there; `sitemap.ts` works either way and was left alongside
it). `/admin` now sits as a sibling top-level segment with its own
`layout.tsx` (`<html>`/`<body>`, no storefront chrome) and its own
`admin.css` (imports the same shared `tokens.css` design tokens, but
not the storefront's `globals.css`, which has storefront-specific rules
like the 1440px `.container` and page-fade keyframe that don't fit an
admin shell with a persistent sidebar).

**Verified nothing broke from the move:** `(storefront)/layout.tsx`'s
`globals.css` import was one directory deeper after the move and had
to be corrected (`./globals.css` → `../globals.css`) — caught by
checking it directly, not assumed. Every other relative import in the
moved subtree was checked (`grep` for `"../` / `"./`  across the whole
moved tree) and confirmed safe, since the entire subtree moved as one
unit and internal relative relationships (e.g. `category/[slug]/
page.tsx`'s `../../products/products-page.module.css`) are preserved
by construction. `robots.ts` (already disallows `/admin` — no edit
needed) and `sitemap.ts` (only builds fully-qualified URLs, no
filesystem path assumptions) were both re-read in full and confirmed
unaffected.

### What was built

**API clients** (`apps/web/src/lib/`): `admin-auth-client.ts`,
`admin-orders-client.ts` — both mirror the existing customer-side
client pattern (`otp-auth-client.ts`/`checkout-client.ts`:
`credentials: "include"`, real backend error messages surfaced, never
replaced with a blind generic string) but are deliberately their own
files, not a shared generic with the customer clients — admin and
customer auth are separate security domains end-to-end per the backend
architecture, and that separation stays visible in the frontend too.
`AdminOrderView` reuses the customer-side `OrderView` type as-is
(same backend `ORDER_INCLUDE` shape, same `OrdersService`) rather than
defining a parallel, driftable type.

**Admin shell** (`apps/web/src/components/admin/`):
`admin-nav-items.ts` (the short, real nav list — see audit above for
why it's short), `admin-shell.tsx` — the one place the admin session
check lives (`getCurrentAdmin()` on mount, redirect to `/admin/login`
if absent), plus a sidebar (desktop, ≥1000px, matching this
repository's existing breakpoint convention) / drawer (mobile) with the
same accessible pattern as the storefront's `Header` (focus trap,
Escape-to-close, body-scroll lock, `aria-expanded`/`aria-controls`,
portalled to `document.body`). Four new icons added to the existing
`icons.tsx` (grid, clipboard-list, activity, logout) using its exact
existing `base()` helper and stroke style — additive, not a rewrite.

**Pages**, all real, all backend-connected, none fake:
- `/admin/login` — real credential submission, real error
  distinction (invalid credentials vs. disabled account vs. rate
  limited, matching the three distinct `AdminAuthService` failure
  reasons read from source), Enter-to-submit via native form
  semantics, no password ever touches the URL.
- `/admin` (dashboard) — **no fabricated statistics**. One real card
  linking to Orders (the one area with a working API), one plain-text
  card stating that products/categories/producers/inventory admin
  isn't available yet. No "۱۲۴ سفارش"-style placeholder numbers
  anywhere.
- `/admin/orders` — list with a status filter, genuine loading
  (skeleton)/empty/error states kept distinct (a `200 + []` renders
  the empty state, not an error), and a real responsive table: full
  `<table>` on ≥768px, each `<tr>` becomes a stacked card on mobile via
  `data-label` + CSS `::before` (a new pattern for this codebase, since
  no prior responsive-table precedent existed here — written directly,
  not copied, then checked for `overflow-x: hidden` shortcuts, which
  the master prompt explicitly forbids; none used).
- `/admin/orders/[orderId]` — full order detail (items, address,
  payment attempts) plus a real "تایید پرداخت" (mark paid) button
  wired to the actual `POST .../mark-paid` endpoint, shown only when
  `status === "PENDING_PAYMENT"` and a card-to-card/Sheba payment
  attempt exists (verified against the real `PaymentMethod` enum in
  `schema.prisma`, not assumed) — an ONLINE-gateway attempt confirms
  itself via callback, not an admin click, so the button correctly
  never appears for that case.
- `/admin/activity-log` — Owner-only page; a STAFF admin's real 403
  from the API renders as an honest "owner only" message, not a
  silent failure or a client-side-only role check standing in for
  server enforcement.

### Verification actually performed this session

**Performed and passed:**
- Brace/paren balance check across every new file (`admin/` under both
  `app/` and `components/`) — all balanced.
- Full manual re-verification of every route-group-move relative
  import, not spot-checked (see "route group restructuring" above).
- An isolated, properly module-resolved `tsc --strict` check (same
  technique as Cycle 7's backend verification — hand-written minimal
  stubs for `react`/`react-dom`/`next/navigation`/`next/link`, real
  relative imports between the actual project files) against every new
  admin frontend file: `admin-shell.tsx` (the most complex — portals,
  refs, the `admin: AuthenticatedAdmin | null | "loading"` discriminated
  state, the focus-trap keyboard handler), both API clients, the login
  page, dashboard, orders list, order detail, and activity log pages.
  **Result: zero errors** once the stubs were made realistic enough
  (added `React.FormEvent`/`ChangeEvent` and a typed `input` intrinsic
  element after an initial pass surfaced two "implicit any" errors on
  `onChange={(e) => ...}` handlers — cross-checked against the
  customer-facing `login-page-client.tsx`, which uses the byte-for-byte
  identical pattern, confirming the errors were a stub-fidelity gap,
  not a real bug, before patching the stub rather than the source).
- Cross-checked the `mark-paid` button's role gating against the
  actual `@UseGuards` decorator on `AdminOrdersController` (only
  `AdminSessionGuard`, no `AdminOwnerGuard`) — confirmed the UI
  correctly does NOT restrict this button to OWNER, since the backend
  doesn't either.
- Confirmed `NEXT_PUBLIC_API_URL` already existed in `.env.example`
  from an earlier cycle — no env changes needed for this cycle.

**NOT performed** (this sandbox still has no outbound network access,
same constraint as Cycles 1–7): `npm install`, `next build`,
`next lint`, real Jest/Playwright execution, actual browser rendering
at any viewport. **The user has been running `npm install`/build
locally since Cycle 7** — the same real verification loop should
continue for this cycle's frontend changes, especially the route-group
restructuring, which is the single highest-risk change in this cycle
and the one most worth a real `next build` pass.

### Final report (per Cycle 8's requested format)

**Files changed:** `apps/web/src/app/(storefront)/layout.tsx` (fixed
the `globals.css` import path after the move: `./globals.css` →
`../globals.css`). Every other storefront file only moved location; no
content changed.

**Files added:** the full `apps/web/src/app/admin/` tree (layout,
admin.css, login, dashboard, orders list + detail, activity log — 15
files) and `apps/web/src/components/admin/` (nav config, shell
component + CSS — 3 files), plus 2 new API client files in
`apps/web/src/lib/`, plus 4 new icons appended to the existing
`icons.tsx`.

**Implemented:** admin login (real API, real error distinction),
protected `/admin` area with a single shared auth guard, responsive
admin layout (sidebar/drawer), a dashboard with zero fabricated data,
full orders management (list/filter/detail/mark-paid) against the real
backend, and an Owner-only activity log page with correct 403 handling.

**Explicitly not built (and why):** product/category/producer/
inventory admin UI — no backend API exists for any of these yet
(verified, not assumed); an admin dashboard stats endpoint — doesn't
exist yet, so the dashboard says so rather than showing invented
numbers; admin user-management (Owner creating Staff accounts) — no
backend endpoint for this exists yet either.

**Build:** not run (no network access in this sandbox for
`npm install`). Static-only verification performed (see above);
real `next build`/`next lint` still needed from the user locally,
same as every prior cycle.

**Typecheck:** not run via the project's own `tsc` (blocked by the same
no-`node_modules` constraint), but a properly module-resolved isolated
`strict: true` check passed cleanly across every new file after
closing two stub-fidelity gaps (see verification section) — this is a
real, if partial, type-soundness signal, not a substitute for the
project's actual `npm run typecheck`.

**Remaining for Cycle 9:** product/category/producer/inventory admin
API + UI (the largest remaining gap); a real dashboard-stats endpoint;
admin user-management endpoints (Owner creating/disabling Staff); and
running the real `npm install`/`next build`/`next lint` pass against
this cycle's route-group restructuring specifically, since that's the
one change here with the highest chance of a build-time surprise this
static analysis couldn't fully rule out.

## Current phase (Cycle 7 account, preserved for history)

### Input repository integrity note (important for future cycles)

The Cycle 6 ZIP provided at the start of this cycle had one corrupted
entry: `apps/api/nest-cli.json` failed standard extraction (overlapping
zip entries). All 168 other files extracted and verified cleanly. The
corrupted file was reconstructed as standard NestJS CLI boilerplate
(`sourceRoot: src`, `tsConfigPath: tsconfig.build.json`) — this file has
no project-specific logic, so nothing was fabricated at the application
level. The GitHub repository (`iAliAssan/Junuban`, 1 commit) was checked
and confirmed to match the same Cycle 6 baseline, not a newer state.
**Recommendation:** verify `apps/api/nest-cli.json` survives your local
`npm install`/`nest build` — it was hand-reconstructed, not extracted
from the original archive, and should be double-checked once real
tooling is available.

### What was audited this cycle

Per the Cycle 7 prompt's Step 0, the full existing repository was
inspected before any changes: all API modules (`auth`, `cart`,
`catalog`, `orders`, `addresses`, `health`), the full Prisma schema (29
models before this cycle), the web app's routes/components, and
`IMPLEMENTATION_STATUS.md`'s own account of prior cycles. Findings
matched the prior status doc closely — no undocumented drift was found.
Confirmed via `grep`: **no admin module, controller, guard, or service
existed anywhere in `apps/api/src` prior to this cycle**, despite the
Prisma schema already modeling `AdminUser` and `ActivityLog`, and
despite `configuration.ts` already reserving an `adminSession` config
block and `main.ts` already registering `addCookieAuth("junuban_admin_session")`
in Swagger — clear evidence this was planned but never built, not
overlooked.

### Completed this cycle — Admin authentication (the Cycle 6 status doc's
own top recommendation)

**New Prisma model:** `AdminSession` — deliberately a separate model
from `CustomerSession` (separate table, separate cookie, separate TTL
shape), matching the master prompt's requirement that admin and
customer identity never share a space. Only a token hash is persisted,
same as `CustomerSession`. Schema now has 30 models; brace/model-count
integrity re-verified after the edit.

**New backend module** `apps/api/src/admin/`:
- `auth/session/admin-session.service.ts` — session issue/validate/
  revoke, hour-based TTL (reuses the existing `adminSession` config and
  the existing `session.hashSecret`, deliberately — see in-code comment
  for why sharing the secret, not the token space, is safe).
- `auth/guards/admin-session.guard.ts` — validates the admin cookie
  **and re-checks the admin's current `status` on every request** (not
  just at login), so disabling a staff account takes effect
  immediately rather than waiting for session expiry.
- `auth/guards/admin-owner.guard.ts` — server-enforced Owner-only
  gate, must run after `AdminSessionGuard` in the guard chain.
- `auth/admin-auth.service.ts` — Argon2id verification against
  `AdminUser.passwordHash`; per-email rate limiting (10 attempts /
  15 min via Redis, mirroring `OtpService`'s existing rate-limit
  pattern); a dummy-hash constant-time-shape check so a nonexistent
  email doesn't respond measurably faster than a wrong password for a
  real one.
- `auth/admin-auth.controller.ts` — `POST /api/v1/admin/auth/login`,
  `GET /api/v1/admin/auth/me`, `POST /api/v1/admin/auth/logout`.
- `activity-log/activity-log.service.ts` — the first-ever writer for
  the `ActivityLog` model (previously modeled but never written to
  anywhere in the codebase); append-only by contract (no update/delete
  method exists on the service).
- `activity-log/activity-log.controller.ts` — `GET
  /api/v1/admin/activity-log`, gated by **both**
  `AdminSessionGuard` and `AdminOwnerGuard` per the master prompt's
  "Owner-only activity log access must remain owner-only."
- `orders/admin-orders.controller.ts` — `GET /api/v1/admin/orders`,
  `GET /api/v1/admin/orders/:orderId`, `POST
  /api/v1/admin/orders/:orderId/mark-paid`. The mark-paid endpoint is
  the concrete fix for the standing blocker Cycle 6 flagged:
  `OrdersService.markOrderPaid(orderId, confirmedByAdminId?)` has
  existed since an earlier cycle with full transactional logic
  (inventory consumption, order status transition, payment attempt
  confirmation) but was never reachable from any HTTP route because no
  trusted caller existed. No order logic was duplicated — the
  controller only adds the authorization boundary and an activity-log
  write.

**Small additions to existing files (not rewrites):**
- `orders/orders.service.ts` — added `getForAdmin(orderId)` (same
  `ORDER_INCLUDE` shape as the customer-facing lookup, but without the
  ownership check — an admin may view any order) and
  `listForAdmin({ page, pageSize, status })` (paginated, most-recent-
  first). Reuses the module's existing `ORDER_INCLUDE` constant rather
  than duplicating it.
- `app.module.ts` — registered `AdminModule`. Verified no circular
  imports (`AdminModule` → `OrdersModule` → `AuthModule`/`CartModule`/
  `AddressesModule`, none of which reference `AdminModule`).

**Tests added**, following the project's existing hand-rolled-mock
style (no `@nestjs/testing` module, matching `cart.service.spec.ts`'s
pattern): `admin-auth.service.spec.ts` (successful login, wrong
password, nonexistent email still invokes argon2 against a dummy hash,
disabled account, rate limiting after 10 attempts),
`admin-session.guard.spec.ts` (missing cookie, invalid token, disabled
account mid-session, successful auth attaches `adminId`/`adminRole`),
`admin-owner.guard.spec.ts` (OWNER allowed, STAFF rejected), and
additions to the existing `orders.service.spec.ts` for `getForAdmin`/
`listForAdmin`.

### Explicitly NOT done this cycle (and why)

- **No migration file was hand-written.** No `apps/api/prisma/
  migrations/` directory existed anywhere in the repository before this
  cycle — meaning `prisma migrate dev` has apparently never been run
  against this schema, for any model, across all six prior cycles (not
  a new gap this cycle introduced). Hand-authoring Prisma's generated
  migration SQL would be fragile and easy to get subtly wrong; this is
  designed to be the very first thing run locally now that real tooling
  is available (see "Verification" below).
- **No admin UI** (`apps/web` has no `/admin` routes at all yet). This
  cycle was scoped to the backend authentication/authorization
  foundation per the agreed plan; building the admin frontend on top of
  it is real, substantial remaining work.
- **No product/pricing/inventory/discounts/reviews/media/content/team/
  settings admin endpoints** — only auth, orders (list/view/mark-paid),
  and activity-log were built this cycle. The master prompt's full
  admin panel (§24) remains a multi-cycle effort; `AdminModule`,
  `AdminSessionGuard`, `AdminOwnerGuard`, and `ActivityLogService` now
  exist as the reusable foundation for all of it.
- **No admin user-management endpoints** (creating/disabling other
  admins, password reset) — only login against the existing seeded
  Owner account. Needed soon (an Owner currently has no way to create
  Staff accounts through the API), flagged as a good Cycle 8 target.

### Verification actually performed this session

**Performed and passed:**
- Extraction integrity check on the input ZIP (Python `zipfile`,
  per-entry `testzip`/`read`) — identified and isolated the one
  corrupted entry; 168/169 real files verified byte-readable.
- Cross-check against `github.com/iAliAssan/Junuban` (1 commit) —
  confirmed same baseline, not a newer state.
- Prisma schema brace/model-count integrity after the `AdminSession`
  addition (29 → 30 models, braces balanced).
- Brace/paren balance check across all 15 new/edited files in
  `apps/api/src/admin/`.
- A `--noResolve` `tsc` syntax sweep across all 75 `apps/api/src/*.ts`
  files (same technique Cycle 6 used) — surfaced the expected
  "cannot find module" noise (no `node_modules` in this sandbox) plus
  two categories of real-looking signal, both investigated further
  rather than dismissed:
  - `Property 'adminUser'/'adminSession'/'activityLog' does not exist
    on type 'PrismaService'` — expected and confirmed harmless: these
    are new Prisma models and `PrismaService`'s type only gains them
    after `prisma generate` regenerates the client, which needs
    `npm install` first. Cross-checked that the camelCase accessor
    names my code calls (`adminUser`, `adminSession`, `activityLog`)
    exactly match what Prisma derives from the schema's PascalCase
    model names.
  - `Property 'reason'/'retryAfterSeconds' does not exist on type
    'AdminLoginResult'` in the controller's `if (!result.ok)` branch —
    this looked like a real discriminated-union bug, so it was
    **not** taken on faith. Built an isolated, properly
    module-resolved `tsc` check (real relative imports between the
    actual controller/service files, with hand-written type stubs
    for external packages only) rather than trusting the noisier
    `--noResolve` sweep. Result: **zero errors** — the union narrows
    correctly; this was a `--noResolve`-only false positive, the same
    class of artifact Cycle 6's own status notes already documented
    for an unrelated `instanceof` check. Kept as a verified fact, not
    an assumption.
- Manually cross-checked every Prisma field `markOrderPaid` writes to
  (`OrderStatusHistory.changedByAdminId`, `PaymentAttempt
  .confirmedByAdminId`) against the schema to confirm the pre-existing
  service logic this cycle exposes via HTTP is itself sound.
- Confirmed no new `.env.example` variables were needed — 
  `ADMIN_SESSION_COOKIE_NAME`/`ADMIN_SESSION_TTL_HOURS` already existed
  from an earlier cycle; `AdminSessionService` deliberately reuses the
  existing `SESSION_HASH_SECRET` (documented in-code as an intentional
  choice, not an oversight).

**NOT performed** (this sandbox also has no outbound network access —
confirmed at the start of this cycle, same constraint as all six prior
cycles): `npm install`, `prisma generate`/`migrate dev`, `nest build`,
`next build`, actually running the Jest suites, `eslint`, any browser
rendering. **The user has agreed to run `npm install` and the build/test
suite locally and report results back** — this is the first cycle where
that verification is expected to actually happen, rather than remaining
a standing blocker.

### Final report (per the Cycle 7 prompt's requested format)

**Changed:** `apps/api/prisma/schema.prisma` (new `AdminSession` model +
back-relation on `AdminUser`); `apps/api/src/app.module.ts` (registered
`AdminModule`); `apps/api/src/orders/orders.service.ts` (added
`getForAdmin`/`listForAdmin`); `apps/api/src/orders/orders.service.spec.ts`
(tests for the above); `apps/api/nest-cli.json` (reconstructed after
input-archive corruption).

**New files:** the full `apps/api/src/admin/` module — 15 files across
`auth/` (service, controller, DTO, session service, two guards, three
spec files), `orders/` (controller, DTO), `activity-log/` (service,
controller, DTO), plus `admin.module.ts`.

**Fixed:** the standing blocker from Cycle 6 — `markOrderPaid` is now
reachable via a real, guarded, activity-logged HTTP endpoint. Also
repaired the one corrupted file in the input archive.

**Verified:** see "Verification actually performed this session" above
— static analysis and structural checks only; no dependency-backed
command executed in this sandbox.

**Not verified:** `npm install`, `prisma generate`, `prisma migrate
dev` (no migrations directory exists yet for the *entire* schema, not
just this cycle's addition — flagged as the most urgent next action),
`nest build`, `next build`, real Jest execution, `eslint`, runtime
behavior of the argon2/Redis calls.

**Remaining:** admin frontend (`/admin` routes in `apps/web`) does not
exist at all; most of the admin panel's business modules (products,
pricing, inventory, discounts, reviews, media, content, team, settings)
remain unbuilt; no admin user-management endpoints yet (Owner can't
create Staff accounts via API); content pages and producer detail pages
remain out of scope (per Cycle 6's own standing decision).

**Next cycle:** once the user's local `npm install` + `prisma migrate
dev` + `npm test` results come back, the next cycle should (1) fix
anything those surface, (2) build the minimal admin login page in
`apps/web` so this cycle's backend work is actually usable, and (3)
extend `AdminModule` with product/inventory management, which is the
next-highest-value gap after order fulfillment.

## Current phase (Cycle 6 account, preserved for history)

Cycle 6 was explicitly an audit-and-polish cycle rather than a new-
feature cycle. The most valuable outcome was **finding and fixing a
real, concrete regression that had existed since Cycle 1 and survived
five cycles unnoticed**: dead navigation links. Everything else this
cycle is deliberate, scoped UX polish on top of the already-working
purchase flow (Cycles 1–5).

## Audit findings this session (the actual substance of this cycle)

Per this cycle's "trace the current customer journey" instruction, every
`href` in every shared component (Header, Footer, UtilityBar) was
diffed against every real route in `apps/web/src/app`. Findings:

**Real, confirmed dead links (existed since Cycle 1, never caught by any
prior cycle's verification because syntax/type checks don't catch
`href` strings pointing at nonexistent routes):**
- `/producers` (Header nav + Footer) — no page ever existed, despite the
  backend `GET /producers` endpoint existing since Cycle 2.
- `/about`, `/about/producers`, `/authenticity`, `/guide`,
  `/shipping-returns`, `/contact` (Footer) — no backend content-page API
  was ever built (the `ContentPage` Prisma model and its seed rows from
  Cycle 2 were never exposed through any controller).
- `/orders/track` (UtilityBar, Header mobile drawer) — guest order
  tracking was explicitly deferred in Cycles 4 and 5's own status docs,
  but the link was never removed.

**Fixed, not left in place:**
- Built a **real** `/producers` listing page using the existing `GET
  /producers` backend endpoint. Each producer links to
  `/products?producerSlug=<slug>` — reusing the existing, already-tested
  producer filter on the product listing rather than inventing a
  producer-detail page the backend doesn't support (no `GET
  /producers/:slug` endpoint exists; building a detail page around it
  would have meant fabricating content, which is explicitly forbidden
  this cycle).
- Removed the content-page and order-tracking dead links entirely
  (Footer, UtilityBar, Header mobile drawer) rather than leaving them as
  404s or inventing rushed/inaccurate content to fill them — per this
  cycle's own instruction to "document them for the appropriate cycle
  rather than creating inaccurate legal text." Footer's link columns
  were restructured (`فروشگاه` + `حساب کاربری`, both fully real) and its
  CSS grid adjusted from 4 to 3 columns to match.
- Also removed an unbacked claim from the utility bar
  ("تحویل ۲ تا ۴ روز کاری" — delivery in 2–4 business days) since no
  real logistics/delivery-estimate system exists; this bordered on
  exactly the "fake delivery estimates" this cycle explicitly forbids.
  Replaced with the plain, true statement "ارسال به سراسر ایران."

## Completed this cycle

### OTP login — resend/countdown (explicit §6 requirement, was missing)
The login page (built in Cycle 5) only supported entering a phone
number once and starting over entirely to get a new code. Added:
- A 60-second cooldown after each code send (initial or resend), shown
  as "ارسال مجدد کد (N)" with N counting down, becoming a real clickable
  "ارسال مجدد کد" button at zero.
- A distinct "ارسال مجدد کد" action (stays on the code-entry step,
  re-requests for the same number) separate from "تغییر شماره موبایل"
  (which still resets to phone entry, for genuinely changing the
  number).
- Deliberately **not** using `aria-live` on the per-second countdown
  text — a live region announcing every single second would spam screen
  reader users, which is worse than silence. The button's native
  `disabled` state and current label are still correctly exposed to
  assistive tech on focus; this was a considered accessibility decision,
  not an oversight.
- Backend rate-limit/attempt/expiry messages (already specific and
  well-worded since Cycle 1 — e.g. "تعداد تلاش‌های مجاز به پایان رسیده
  است") already flow through to the UI unmodified via the existing error
  handling; no separate frontend logic needed for those cases.

### Restrained micro-animations (§16)
Audited existing animation coverage first (11 of the app's CSS files
already had transitions from prior cycles — Header drawer, FilterPanel,
buttons, cards). Found two genuine gaps and filled them, nothing more:
- A single subtle page-content fade-in (`main`, root layout) — fires
  once per initial load. Considered adding a Next.js `template.tsx` to
  replay it on every client-side navigation too, but decided against it:
  repeated motion on every single navigation would work against this
  cycle's explicit "restrained" directive more than it would help.
  Documented here as a deliberate choice, not a missed opportunity.
- Product card image hover-zoom (`scale(1.04)`, 0.3s) — a well-
  established, subtle e-commerce pattern; `.card` already had
  `overflow: hidden` from Cycle 2 so the zoom clips cleanly at the
  card's rounded corners.
- `SortMenu`'s dropdown panel now animates in (`opacity` + small
  `translateY`/`scale`) instead of popping in instantly — it's
  conditionally mounted (not just hidden), so this needed a CSS
  `@keyframes animation` rather than a `transition` (transitions don't
  animate an element's *initial* appearance).
- All of the above are automatically covered by the global
  `prefers-reduced-motion` rule already established in `tokens.css`
  since Cycle 1 — reconfirmed intact, no per-component reduced-motion
  guards were needed.

### Repo-wide TypeScript-suppression audit (§20)
Explicitly searched the entire repository (`apps/api/src`,
`apps/web/src`) for `@ts-ignore`, `@ts-expect-error`, `as any`, and
undocumented `eslint-disable` comments, across all six cycles of work —
not just this session's changes. Result: **zero** unsafe suppressions
found. The one `as any` text match is a code *comment* in
`prisma.service.ts` documenting that Cycle 4 removed the last real one
(replaced with `Prisma.TransactionClient`) — historical documentation,
not an actual cast. Every `eslint-disable` present is one of the four
already-justified cases (`no-console` for documented dev-only logging,
`no-constant-condition` for the intentional retry loops, `react-hooks/
exhaustive-deps` for intentional one-time effects, `react/no-danger` for
JSON-LD script tags serializing only our own controlled data). This is
reported here as a verified fact, not an assumption.

## Explicitly NOT done this cycle (and why)

- **Content pages** (`/about`, `/contact`, `/authenticity`, `/guide`,
  `/shipping-returns`) — genuinely out of this cycle's scope (customer
  *shopping* UX, not marketing/content pages), and building them
  properly needs both a new backend endpoint (`GET /content-pages/:slug`
  — the `ContentPage` model exists but nothing serves it) and real
  written content. Per this cycle's §25, documenting this gap honestly
  was the correct choice over rushing inaccurate copy. **Recommended for
  a dedicated content/CMS cycle**, not bundled into commerce-flow work.
- **Guest order tracking** — same standing decision as Cycles 4/5
  (a guest's only view of their order remains the immediate
  post-checkout confirmation). The dead `/orders/track` link pointing at
  this nonexistent feature has now been removed rather than left broken.
- **Producer detail pages** — deliberately not built; no backend
  endpoint exists for one, and inventing a page that shows nothing but
  what the list already shows would have been hollow. The `/producers`
  page links to the real, already-working producer-filtered product
  list instead.
- Admin payment confirmation, real payment gateway, admin auth —
  unchanged standing blockers from Cycles 4/5.

## Verification actually performed this session

**Performed and passed:**
- Full-repo `tsc --noResolve` syntax sweep — zero new real errors
  (flagged lines are the same, repeatedly-confirmed `instanceof`
  `--noResolve`-only artifact, including one new instance in the
  login page's resend handler, which is the same safe pattern already
  independently verified three times this project).
- Import-resolution check: 59 web files, all resolve.
- CSS Module class-reference audit: 40 tsx files, all resolve.
- **A new check this cycle**: programmatic dead-link scan comparing
  every static `href` in every component against every real route in
  `apps/web/src/app` (including dynamic-route pattern matching for
  `[slug]`-style routes). Found 4 categories of dead link (detailed
  above), fixed all of them, re-ran the scan afterward — zero unmatched
  hrefs remain. This is a genuinely new verification technique for this
  project, not previously part of any cycle's method, and is now worth
  reusing in future cycles whenever navigation changes.
- Repo-wide `@ts-ignore`/`@ts-expect-error`/`as any`/`eslint-disable`
  audit across the entire codebase (not just this session's diff) —
  zero unsafe suppressions found, reported as a verified fact.
- Prisma schema brace/model-count integrity — unchanged, still valid.
- Explicit regression re-check of every item named in this cycle's own
  §26 checklist: Header portal/hamburger, `tokens.css` path, sitemap's
  network-failure safety, `apiGet`'s error wrapping,
  `classifyLoadError`'s empty-vs-error distinction, no Wishlist
  reintroduction, `harvestSeason` intact, `ProductProducer` relation
  intact — all confirmed present and untouched except where this
  cycle's own fixes intentionally touched them (Header's drawer footer
  links only — the portal/scroll-lock/focus-trap logic itself was not
  modified).

**NOT performed (same standing constraint, now spanning all six
cycles):** `npm install`, `prisma generate`/`validate`, `next build`,
`nest build`, running the Jest suites for real, `eslint`, any actual
browser rendering. This sandbox has never had outbound network access.
This remains the single most valuable next action for whoever continues
this project.

## Final report (per this cycle's requested format)

**1. Files changed:** ~10 — `apps/web/src/app/producers/{page.tsx,
producers-page.module.css}` (new); `apps/web/src/components/{footer,
utility-bar,header}/*` (dead links removed/replaced); `apps/web/src/app/
account/login/{login-page-client.tsx,login-page.module.css}` (resend/
countdown added); `apps/web/src/components/product-card/
product-card.module.css` (hover zoom); `apps/web/src/components/
product-filters/sort-menu.module.css` (open animation);
`apps/web/src/app/globals.css` (page fade-in).

**2. Features completed:** real `/producers` page; OTP resend with
countdown; restrained animation polish (3 additions); full dead-link
elimination.

**3. Bugs fixed:** 4 categories of dead link spanning Header, Footer,
and UtilityBar, present since Cycle 1; an unbacked delivery-time claim
removed.

**4. Tests/typecheck/build actually run:** no dependency-backed command
executed (no network access, unchanged since Cycle 1). Static-analysis
substitutes performed and passed — see "Verification actually performed"
above, including a new automated dead-link scan.

**5. Blocked by backend/database/API:** content pages (no serving
endpoint), producer detail pages (no endpoint), guest order tracking (no
endpoint), admin payment confirmation (no admin auth), real payment
gateway (no credentials).

**6. Recommended next cycle:** a real `npm install` + build/test run is
now overdue across six cycles and should be the very first action of
whichever cycle can access it. Functionally, admin authentication is the
next highest-value item (it's the single blocker standing between the
already-implemented `markOrderPaid` domain logic and an order actually
being fulfillable end-to-end).
