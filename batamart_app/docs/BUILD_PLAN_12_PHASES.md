# Batamart Flutter App — 12-Phase Build Plan

This is the master build plan for the Flutter Android app. It exists so you can open a session in this
folder any time and just say **"let's do Phase N"** — the phase description below has enough scope,
references, and acceptance criteria that a session with zero prior conversation history can execute it
correctly, using `CLAUDE.md`, `WEB_PAGES_REFERENCE.md`, and `BACKEND_REFERENCE.md` as its source of truth.

## How to use this document

1. Say which phase to work on ("Phase 4", "let's start phase 1", etc.). Phases are meant to be done in
   order — each one assumes prior phases are complete.
2. Before writing code, the session should read this phase's **Scope**, **Reference material**, and
   **Out of scope** sections, and resolve anything under **Open decisions** with you before proceeding.
3. UI for every phase comes from **your mockup images** for the relevant screens, not from the old web
   app — `WEB_PAGES_REFERENCE.md` only defines *behavior* (what a screen does, what every button
   navigates to). If a mockup for a screen in scope hasn't been provided yet, the session should ask for
   it rather than invent a design.
4. When a phase is finished, the session updates the **Progress Tracker** below (status + one-line note)
   and this file's changelog, so the next session (possibly you, possibly a fresh one) can see where
   things stand at a glance.
5. Phase 12 is done = the app is feature-complete against `WEB_PAGES_REFERENCE.md`'s buyer/seller/rider
   navigation graph — every route that exists on the web has an equivalent screen, every button/link goes
   to the equivalent destination.

## Global rules (apply to every phase)

- **No new routes, no removed routes, no rewired buttons.** The functional navigation graph in
  `WEB_PAGES_REFERENCE.md` is fixed. Visual redesign is total freedom; behavior is not.
- **Same backend, same database, no parallel API.** Every network call goes to the existing `/api/*`
  routes documented in `BACKEND_REFERENCE.md`. Never invent a new endpoint.
- **This folder has no backend code.** A few phases (flagged below under "Cross-repo dependency") need a
  small change in the *main* Next.js repo (`bata-marketplace/`, one level up from wherever this folder
  ends up). The session can't make that change if this folder has been moved somewhere fully separate —
  flag it to you and give you the exact diff to apply yourself, or ask you to grant access to that repo.
- **Auth**: JWT bearer token from login/signup response body, stored in `flutter_secure_storage`, sent as
  `Authorization: Bearer <token>` on every authenticated call. Full detail in
  `BACKEND_REFERENCE.md` §1.
- Icons: a real icon set (Material/Cupertino), never emoji, for badges/status indicators.

---

## Progress Tracker

| Phase | Name | Status | Notes |
|---|---|---|---|
| 1 | Project Setup & Architecture Foundation | Done | dio/riverpod/go_router/secure_storage/hive wired; `GET /api/universities` renders end to end; see this repo's README |
| 2 | Design System Implementation | Done | Palette/type/spacing tokens sampled from collage_v1.png; full widget library + kitchen sink; both nav shells; app icon/splash generated. See repo README |
| 3 | Auth & Onboarding | Done | All auth screens + role-aware router guards built; CSRF workaround and Google Sign-In stubbed per your call. See repo README |
| 4 | Marketplace & Product Browsing | Done | All browsing screens built; guest browsing narrower than web spec due to real API auth constraints. See repo README |
| 5 | Cart & Checkout & Payments | Done | WebView-hosted Flutterwave checkout chosen over 3rd-party SDK; two real Android manifest network bugs found+fixed. See repo README |
| 6 | Buyer Orders & Post-Purchase | Done | Orders/Order Detail/Review screens built; live map deferred (no Maps API key yet). See repo README |
| 7 | Seller Features | Done | My Shop, Sell (4-step), Sales, seller-view Order Detail sections all built. See repo README |
| 8 | Wallet, Referrals & Notifications | Done | Wallet+biometric withdraw, Referrals, Notifications built; FCM wired client-side pending Firebase project + new backend endpoint. See repo README |
| 9 | Disputes & Reports | Done | Dispute Select-Order/File/Detail + generic Report screen built; hidden from riders via existing route wall. See repo README |
| 10 | Rider App Flow | Done | Dashboard, Deliveries, GPS broadcast (foreground-only), Order Detail rider-view all built. See repo README |
| 11 | Cross-Cutting Polish & Edge Cases | Done | Global 401 handling, suspended-account screen, pull-to-refresh everywhere, push deep-link plumbing. See repo README |
| 12 | Testing, QA & Release Readiness | In progress | Env/credentials wired (Firebase, Google Sign-In, release keystore, prod API URL); nav-graph + performance audits done and fixed; privacy policy drafted; release AAB build in progress. Manual on-device QA and Play Store screenshots still need a real device. See repo README |

Status values: `Not started` / `In progress` / `Done` / `Blocked (see note)`.

---

## Phase 1 — Project Setup & Architecture Foundation

**Goal**: A running, empty Flutter app with the architecture every later phase builds on.

**Scope**
- `flutter create` the project (package name: lowercase_with_underscores, e.g. `batamart_flutter`).
- Pick and wire up the core stack (recommended defaults — swap any of these if you have a preference,
  but decide before Phase 2 so later phases don't have to re-plumb):
  - HTTP client: `dio` (interceptor support makes attaching the bearer token and handling 401s easy)
  - State management: `riverpod`
  - Routing: `go_router` (supports role-based redirect guards, similar to the web's `middleware.ts`)
  - Secure token storage: `flutter_secure_storage`
  - Local persistence (cart, since there is no cart API — see `BACKEND_REFERENCE.md`): `hive` or
    `shared_preferences`
- Project folder structure (feature-first, e.g. `lib/features/{auth,marketplace,cart,orders,wallet,...}`,
  `lib/core/{api,models,theme,router}`).
- API client foundation: base URL from a build-time config (`--dart-define` or `.env` via
  `flutter_dotenv`), a `Dio` instance with an auth-header interceptor, centralized error handling for the
  standard error response shape documented in `BACKEND_REFERENCE.md`.
- Environment config for at least two targets (local dev against `next dev`, and production).
- Linting/formatting setup (`flutter_lints`).
- App bootstraps to a placeholder screen confirming it can hit `GET /api/universities` (a safe,
  unauthenticated, low-risk endpoint) and render the response — proves the API wiring works end to end
  before any real UI exists.

**Reference material**: `BACKEND_REFERENCE.md` §1 (Auth & Base Setup), §2 (Data Model Reference).

**Out of scope**: any real screens, auth, design system.

**Open decisions to confirm with you**: state management / routing package choice if you don't want the
defaults above; whether local dev will point at `next dev` on your LAN or a deployed staging URL.

**Definition of Done**
- [ ] `flutter run` launches successfully on an Android emulator/device
- [ ] App fetches and displays `GET /api/universities` data on first launch
- [ ] Folder structure and chosen packages committed with a short architecture note in this repo's own
      README (create one if it doesn't exist)

---

## Phase 2 — Design System Implementation

**Goal**: Every reusable visual building block exists once, correctly, from your mockups — so no later
phase re-derives colors/spacing/components ad hoc.

**Scope**
- Extract from your mockup images: color palette, typography scale, spacing scale, corner
  radii/elevation/shadow conventions.
- `ThemeData` (and dark mode if your mockups include it).
- Reusable widget library: buttons (primary/secondary/danger), text inputs, cards (product card, order
  card), badges/status chips (order status, trust level, campaign tag — see enums in
  `BACKEND_REFERENCE.md`), app bar, bottom sheet shell, modal/dialog shell, loading skeleton, empty state,
  error state.
- Two structurally separate bottom-navigation shells, confirmed with the user: a buyer/seller shared nav
  (Home / Deals / Cart / Orders / Profile, per the mockups), and a rider nav (Dashboard / Deliveries /
  online-offline toggle / Earnings / Profile, per `WEB_PAGES_REFERENCE.md` — **not** the buyer-style nav
  shown in the rider mockup frames, which was confirmed a template artifact; see
  `docs/mockups/README.md` "Resolved: rider bottom nav"). Reuse the rider frames' visual style only
  (colors/cards/typography), restyled onto this correct nav structure.
- App icon and splash screen from your branding assets.

**Reference material**: `docs/mockups/` (see `README.md` for the page-by-role inventory and the resolved
nav-scope decision) for look; `WEB_PAGES_REFERENCE.md` intro section for which nav variants must exist.

**Out of scope**: screens with real data/logic. This phase produces a component catalog (a debug
"kitchen sink" screen showing every component is fine and encouraged), not finished features.

**Open decisions to confirm with you**: mockups for every screen category not yet covered by
`docs/mockups/collage_v1` (referrals detail states, error/empty states, dark mode if wanted), or enough
representative screens to derive a consistent system from.

**Definition of Done**
- [ ] Theme + full widget library implemented and visually matches supplied mockups
- [ ] Both nav shells built (not yet wired to real routes)
- [ ] App icon/splash in place

---

## Phase 3 — Auth & Onboarding

**Goal**: A user can create an account, log in, and land on an authenticated shell, for all three roles.

**Scope**
- Screens: Login, Signup, OTP verification, Forgot/Reset Password, Profile Setup (hostel/room/landmark —
  required before checkout), Rider Login (separate flow/screen), Google Sign-In (native, not the web
  OAuth redirect — needs its own Android client ID, see Open decisions).
- Token storage + auto-attach on requests (built in Phase 1; wire real login/signup calls to it here).
- Role-aware landing: after login, route BUYER/SELLER to the main shell, RIDER to the rider shell — mirror
  the walled-garden logic (`middleware.ts` on the web) as a client-side route guard, understanding it's
  now also enforced server-side per-endpoint (see `BACKEND_REFERENCE.md` rider gating notes).
- "Become a Seller" upgrade flow (buyer → seller, `BACKEND_REFERENCE.md` Auth domain).
- Logout.

**Reference material**: `BACKEND_REFERENCE.md` §1.3 (same-origin gotcha), Auth domain endpoints
(login-with-password, signup-with-password, send-otp, verify-otp, google, reset-password, me,
update-profile, toggle-seller-mode, become-seller, suspension-info). `WEB_PAGES_REFERENCE.md` shared-pages
auth chain (signup → verify → profile setup → marketplace).

**Cross-repo dependency (blocking)**: `login-with-password`, `send-otp`, `reset-password`, `riders/login`,
`riders/register` are rejected by the backend's same-origin CSRF check for any request without a bearer
token — which includes the app's very first login/signup call. This phase cannot fully work until the
main repo's `lib/security/request.ts` `allowedOrigins()` is updated (or another workaround from
`BACKEND_REFERENCE.md` §1.3 is applied). Flag this immediately if it's not already fixed; don't spend time
debugging a 403 on first login before checking this.

**Open decisions to confirm with you**: Google Sign-In Android client ID / SHA-1 fingerprint setup (needs
a Google Cloud Console entry separate from the web app's); whether biometric login (device
fingerprint/face unlock as a *login* shortcut, distinct from the wallet's biometric withdrawal in Phase 8)
is wanted.

**Definition of Done**
- [ ] All auth screens implemented against real mockups
- [ ] A BUYER, a SELLER, and a RIDER test account can each log in and land on the correct shell
- [ ] Token persists across app restarts; expired/invalid token correctly forces re-login
- [ ] Same-origin CSRF blocker confirmed fixed (see cross-repo dependency above)

---

## Phase 4 — Marketplace & Product Browsing

**Goal**: Browsing works for guests and logged-in users alike, matching the web's discovery surface.

**Scope**
- Screens: Marketplace/home feed (categories, deals rows, infinite "just dropped" scroll), Deals, Most
  Bought, Search + filters, Product Detail (gallery, variant selection, reviews tab, related products),
  Product full reviews list, Seller Directory, Seller Profile, Seller's full catalog.
- Guest browsing (no login) with a login prompt gated only on actions (add to cart / buy now / report),
  matching the web's behavior.
- Product view/impression tracking if you want the "hot product" / "people also viewed" logic to keep
  working the same way (`products/[id]/view`, `session-event` — see `BACKEND_REFERENCE.md`).

**Reference material**: `WEB_PAGES_REFERENCE.md` Shared Pages table (Marketplace through Seller's Full
Catalog rows). `BACKEND_REFERENCE.md` Products & Search domain in full.

**Out of scope**: cart/checkout (Phase 5), reviews *submission* (Phase 6 — this phase is read-only
review display).

**Definition of Done**
- [ ] All browsing screens implemented and navigable exactly per `WEB_PAGES_REFERENCE.md`'s shared-pages
      outbound-nav column
- [ ] Works fully logged-out except for gated actions, which prompt login and return to the same screen
      after

---

## Phase 5 — Cart & Checkout & Payments

**Goal**: A buyer can go from product to paid order.

**Scope**
- Cart screen: **client-side only state** (no cart API exists — see `BACKEND_REFERENCE.md`; cart must be
  built/persisted locally, e.g. with the Hive/shared_preferences layer from Phase 1), quantity/variant
  editing, live delivery-fee quote (`/api/delivery/quote`).
- Checkout screen: address summary (from profile), per-item order notes, escrow explainer copy, payment
  initiation (`/api/payments/initialize`).
- Payment completion handling: `GET /api/payments/verify` is an **HTTP redirect, not JSON** — this needs
  an in-app WebView (or Custom Tabs) hosting the Flutterwave checkout page, watching for the redirect back
  to the verify URL / a success deep link, then routing to Orders. Handle failure/cancel paths explicitly.
- Payment-method availability check (`/api/payment-availability`) before showing the pay button.

**Reference material**: `BACKEND_REFERENCE.md` Checkout & Payments domain in full (read the payments/verify
redirect-callback note carefully before choosing an implementation approach).
`WEB_PAGES_REFERENCE.md` Buyer-specific pages: Cart, Checkout.

**Open decisions to confirm with you**: Flutterwave's Flutter/mobile SDK vs. a raw WebView around the
hosted checkout page — check current Flutterwave Flutter SDK support before committing to an approach.

**Definition of Done**
- [ ] A full purchase can be completed end to end against a real (or Flutterwave test-mode) payment and
      lands on Orders with the correct success state
- [ ] Delivery fee quote matches what the web app would quote for the same zone pair
- [ ] Payment failure/cancellation is handled without leaving the user stuck in a WebView

---

## Phase 6 — Buyer Orders & Post-Purchase

**Goal**: Everything a buyer does after paying.

**Scope**
- Screens: Orders (history list), Order Detail (universal screen — buyer's view here; seller/rider views
  come in Phases 7/10 reusing the same screen with role-conditional sections), Review Product, Review
  Seller, "Confirm Received" action.
- Live rider-location map on Order Detail during active delivery states (`orders/[id]/live-location`).
- Order status badges matching the `OrderStatus` enum in `BACKEND_REFERENCE.md`.

**Reference material**: `WEB_PAGES_REFERENCE.md` Shared Pages (Order Detail) + Buyer-specific pages
(Orders, Review Product, Review Seller). `BACKEND_REFERENCE.md` Orders domain + Reviews domain.

**Definition of Done**
- [ ] Full buyer order lifecycle visible and actionable: place order → track status → confirm received →
      review product → review seller
- [ ] Order Detail correctly renders every `OrderStatus` value with an appropriate UI state

---

## Phase 7 — Seller Features

**Goal**: A seller can list products and fulfill incoming orders.

**Scope**
- Screens: Sell (multi-step listing creation — category/subcategory, images upload via `/api/upload`,
  variants/attributes, price, campaign opt-in, platform-fee confirmation modal showing the real 5%+
  delivery-cut formula from `BACKEND_REFERENCE.md`), My Shop (inventory dashboard: stats, search/filter,
  pause/activate/restock/delete), Sales (incoming orders, Accept Order action), Order Detail seller-view
  sections.
- Seller-mode toggle (buyer ⇄ seller UI switch, `toggle-seller-mode`).

**Reference material**: `WEB_PAGES_REFERENCE.md` Seller-specific pages. `BACKEND_REFERENCE.md` Products
domain (my-products, restock) + Orders domain (seller-orders, sales) + the platform commission business
rule.

**Definition of Done**
- [ ] A seller can list a product with variants and see it appear correctly in buyer-side browsing
      (Phase 4)
- [ ] Seller can accept an incoming order and see its status advance as a rider/buyer act on it

---

## Phase 8 — Wallet, Referrals & Notifications

**Goal**: Money management and the notification/referral loop, shared across all three roles.

**Scope**
- Wallet screen: balance, escrow amount, transaction history, withdraw flow (bank details + PIN, and
  biometric-confirmed withdrawal using the device's actual biometric API — distinct from any login
  biometrics), PIN set/change/forgot modals with the lockout behavior documented in
  `BACKEND_REFERENCE.md` (5 attempts / 15-minute lock).
- Role label swap: "Earnings" framing for RIDER, standard wallet framing for BUYER/SELLER — same
  screen/data source, per `BACKEND_REFERENCE.md`.
- Referrals screen: code/link, share sheet (native share, not web share-button equivalents), stats.
- Notifications screen: full list, mark-read/delete, deep-link routing per `NotificationType` (see enum in
  `BACKEND_REFERENCE.md`) to the correct screen from any earlier phase.
- Push notifications: **the backend only supports Web Push (VAPID)** — native Android push needs either a
  new FCM integration (cross-repo dependency, backend work required) or push is explicitly deferred for
  v1 in favor of in-app/pull-based notifications only. Decide before building.

**Reference material**: `BACKEND_REFERENCE.md` Wallet, Referrals, Notifications domains + the withdrawal
PIN and referral-crediting business rules.

**Open decisions to confirm with you**: push notification approach (see above) — this materially changes
scope, confirm before starting.

**Definition of Done**
- [ ] Withdraw flow works end to end including PIN lockout behavior
- [ ] Every `NotificationType` deep-links correctly
- [ ] Push decision made and either implemented or explicitly documented as deferred

---

## Phase 9 — Disputes & Reports

**Goal**: The buyer/seller conflict-resolution path.

**Scope**
- Screens: Dispute Select-Order, File a Dispute (reason, description, evidence upload, pickup address),
  Dispute Detail/tracking (messages thread, status per the `DisputeStatus` state machine in
  `BACKEND_REFERENCE.md`), Confirm Return action, Report a product/rider form.
- Hidden entirely from RIDER accounts, matching the web app.

**Reference material**: `WEB_PAGES_REFERENCE.md` Shared Pages (Dispute: Select Order, Report) + Buyer-
specific (File a Dispute). `BACKEND_REFERENCE.md` Disputes & Reports domain + the dispute state-machine
business rule (including internal sentinel strings — read carefully, they're not obvious from the enum
alone).

**Definition of Done**
- [ ] A dispute can be opened, messaged on, and its status reflects backend state accurately
- [ ] Not reachable at all from a RIDER-logged-in session

---

## Phase 10 — Rider App Flow

**Goal**: The complete, structurally separate rider experience.

**Scope**
- Rider Login (already scaffolded in Phase 3, finished here in context).
- Rider Dashboard: available delivery batches list, batch acceptance, "My Active Batches" with per-order
  status-advance actions (Picked Up → On the Way → Delivered), dispute-pickup jobs
  (`riders/dispute-picked-up`), oversized-item decline flow (`riders/decline-oversized`).
- Live GPS broadcast toggle (`riders/live-location`) — needs Android location permission handling and a
  background-safe location stream.
- Online/offline availability toggle (`riders/toggle-availability`).
- Rider bottom nav: Dashboard / Deliveries / online-offline toggle / Earnings (→ Wallet from Phase 8,
  role-labeled) / Profile sheet (→ Notifications from Phase 8, Logout).
- Order Detail rider-view sections (reusing the universal screen from Phase 6/7).

**Reference material**: `WEB_PAGES_REFERENCE.md` Rider-specific pages. `BACKEND_REFERENCE.md` Riders
domain in full + the delivery-batch business rule (one buyer order can span multiple seller "legs",
batched for one rider). `docs/mockups/README.md` "Resolved: rider bottom nav" for the visual-style-only
reuse of the rider mockup frames — do not port the Home/Deals/Cart nav icons shown there.

**Definition of Done**
- [ ] A rider account can never reach a buyer/seller-only screen (verify against the walled-garden rule)
- [ ] Rider nav shell matches the confirmed Dashboard/Deliveries/toggle/Earnings/Profile structure, not
      the buyer-style nav shown in the raw mockup frames
- [ ] Full batch lifecycle works: accept → advance each leg's status → batch completes
- [ ] GPS broadcast visibly updates the buyer's live-tracking map from Phase 6

---

## Phase 11 — Cross-Cutting Polish & Edge Cases

**Goal**: The app feels finished and handles the unhappy paths, not just the golden path.

**Scope**
- Loading/skeleton states, empty states, error states (network failure, 401 → forced re-login, 403,
  validation errors) applied consistently across every screen from Phases 3–10.
- Suspension/penalty banners (account suspended, warning issued — `BACKEND_REFERENCE.md` suspension
  business rule).
- Permissions handling: location (rider GPS), camera/gallery (product images, dispute/report evidence,
  profile photo), biometrics (wallet withdrawal).
- Deep linking (e.g. tapping a push/in-app notification opens the right screen even from a cold start).
- Pull-to-refresh and pagination consistency on every list screen.
- Accessibility pass (contrast, tap targets, screen reader labels) against whatever your mockups specify.

**Reference material**: whichever domain sections in `BACKEND_REFERENCE.md` correspond to the error cases
being handled; re-scan `WEB_PAGES_REFERENCE.md`'s "Known rough edges" section to make sure this app didn't
inherit the same dead-end stubs.

**Definition of Done**
- [ ] Every screen has a defined loading/empty/error state, not just a happy-path render
- [ ] Suspended-account and permission-denied paths are handled, not crashes

---

## Phase 12 — Testing, QA & Release Readiness

**Goal**: Ship-ready build.

**Scope**
- End-to-end walkthrough for all three roles against the real API, checked line-by-line against
  `WEB_PAGES_REFERENCE.md`'s navigation graph — every button verified to reach its documented destination.
- Confirm every `BACKEND_REFERENCE.md` gotcha was actually addressed: same-origin CSRF fix live, payments
  verified end to end (not just test-mode), push notification decision implemented as scoped, the
  legacy/inconsistent order endpoints (`POST /api/orders`, raw `PATCH /api/orders/{id}`) were avoided in
  favor of the real checkout + `confirm-delivery` paths.
- Performance pass (cold start time, image loading/caching, list scroll performance).
- Release build config: app signing (keystore), versioning, `flutter build appbundle`.
- Play Store listing assets (screenshots, description, privacy policy link — Batamart handles PII and
  payments, a privacy policy is required).

**Reference material**: both reference docs in full, used as the acceptance checklist.

**Definition of Done**
- [ ] Full manual QA pass across BUYER, SELLER, RIDER completed with no broken navigation
- [ ] Signed release AAB builds successfully
- [ ] Store listing assets ready

---

## Changelog

- Initial 12-phase plan created.
- 2026-08-02: Phase 1 done — Flutter project scaffolded (Android target), dio/riverpod/go_router/
  flutter_secure_storage/hive wired, `GET /api/universities` proves the API wiring end to end. See
  the repo's own `README.md` for the architecture note.
- 2026-08-02: Phase 2 done — design tokens (colors sampled from `collage_v1.png`/logo, Poppins
  typography, spacing/radii), full reusable widget library, kitchen-sink debug screen, buyer/seller +
  rider bottom nav shells (not yet wired to routes), and generated app icon/splash from the logo
  assets. See the repo's own `README.md` for detail.
- 2026-08-02: Phase 3 done — full auth screen set, AuthController + AuthRepository covering every
  `/api/auth/*` and rider auth endpoint, and role-aware go_router redirect guards (splash/onboarding →
  login/signup/rider-login → profile-setup-if-incomplete → home/rider shell). CSRF same-origin
  workaround and Google Sign-In stub applied per the user's explicit call — see repo README "Phase 3
  status" for what's provisional (no mockup yet for Signup/OTP/Forgot-Reset/ProfileSetup/RiderLogin/
  BecomeSeller) and the login-field mismatch flagged (mockup says "Email or Phone", API only takes
  email).
- 2026-08-02: Phase 4 done — Marketplace Home, Deals, Search, Most Bought, Product Detail, Product
  Reviews, Seller Directory, Seller Profile, Seller's Full Catalog, all wired to real
  `/api/products*`/`/api/reviews`/`/api/sellers` endpoints. Found and flagged a real spec/API mismatch:
  `GET /api/products` and `/feed` require auth, so true guest browsing (as WEB_PAGES_REFERENCE.md
  describes) only works for Product Detail + its Reviews, not the rest of the browsing surface. Seller
  Directory has no backing "list all sellers" endpoint — built as a client-side derivation from the
  feed instead, flagged as incomplete. See repo README "Phase 4 status" for full detail.
- 2026-08-02: Phase 5 done — client-local Hive-backed cart (reconciled against `POST /api/cart/add`),
  Checkout screen matching the mockup exactly, and a WebView-hosted Flutterwave payment flow (resolved
  the open decision in this phase's own scope in favor of `webview_flutter` over a 3rd-party SDK, since
  the backend's flow is redirect-based end to end anyway). Found and fixed two real Android manifest
  bugs while wiring this: missing `INTERNET` permission in the release manifest, and cleartext HTTP
  traffic blocked by default for the local-dev API URL. See repo README "Phase 5 status".
- 2026-08-02: Phase 6 done — Orders (status tabs matching the mockup), Order Detail (universal screen,
  buyer view; tracking stepper + rider card + polled live-location text pending a Maps API key),
  Review Product, Review Seller. Used `confirm-delivery` (never raw PATCH) for Confirm Received per
  BACKEND_REFERENCE.md's explicit escrow warning. Flagged: the mockup's "To Pay" orders tab can never
  have contents given the backend's payment-first order-creation design. See repo README "Phase 6
  status".
- 2026-08-02: Phase 7 done — My Shop, All Products (view/pause/restock/delete), Sell/Add Product
  (4-step, only step 1 had a mockup), Sales (Accept Order action), and seller-view sections on Order
  Detail (buyer contact info, Accept Order for PENDING). Confirmed My Shop/Sales are Profile-reached
  pushed screens, not bottom-nav tabs, from the mockup's own nav state. See repo README "Phase 7
  status" for the stat-tile data-source stopgap and category/variant free-form-field caveats.
- 2026-08-02: Phase 8 done — Wallet (shared across all 3 roles, Earnings label-swap for RIDER),
  PIN set/change/forgot flows with the documented lockout behavior, biometric-confirmed withdrawal
  (required an Android MainActivity change + minSdk bump to 23 for local_auth), Referrals, and
  Notifications (all 27 NotificationType values deep-link). Per the user's explicit calls: biometric
  withdrawal implemented; push notifications built client-side (firebase_core/firebase_messaging) but
  inert until a Firebase project + a new backend FCM-token endpoint exist — flagged in detail in repo
  README "Phase 8 status", including the hardcoded bank list (no bank-list endpoint exists) and the
  unbacked "Add Money" mockup action.
- 2026-08-02: Phase 9 done — Dispute Select-Order, File a Dispute, Dispute Detail (buyer message
  thread; seller gets a read-only view + Confirm Return Received instead, since BACKEND_REFERENCE.md
  §3.9 403s the message endpoints for sellers), and a generic Report screen (reporting a rider from
  Order Detail). Surfaced the `Dispute.resolution` return-flow sentinel strings as plain-English status
  text rather than raw internal values. Confirmed hidden from RIDER accounts via the existing router
  wall, no new code needed. See repo README "Phase 9 status" for the dispute-id cross-referencing
  workaround and the free-text dispute-reason caveat.
- 2026-08-02: Phase 10 done — Rider Dashboard, Rider Deliveries (Active/Completed tabs, per-order
  status advance, oversized decline, dispute-return pickup), foreground-only GPS broadcast, and
  rider-view sections on Order Detail (completing all 3 role views on the universal screen). Flagging
  a real scope cut against the plan's own wording: true "background-safe" GPS broadcast needs a
  foreground service, out of scope for this pass — implemented foreground-only instead, documented in
  repo README "Phase 10 status". Also flagged: no Rider Registration screen exists in
  WEB_PAGES_REFERENCE.md's nav graph despite the backend endpoint being fully documented, and the
  Rider Earnings mockup's Today/Week/Month stats have no backing endpoint. Walled-garden DoD confirmed
  by inspection — no new router code was needed since riders were already confined starting Phase 8.
- 2026-08-02: Phase 11 done — global 401 handling (deliberately narrow trigger, see repo README),
  suspended-account detection with a real reason/until screen (found and fixed a real bug: suspended
  accounts were being treated identically to invalid-token accounts and silently bounced to login with
  no explanation), 3 error-normalization bypasses fixed, pull-to-refresh added to every remaining list
  screen, and push-notification deep-link plumbing (cold start + backgrounded tap) wired but unverified
  pending Phase 8's Firebase/backend gaps. Explicitly did NOT implement true infinite-scroll pagination
  — a half-correct version would make earlier list items disappear on "Load More," which is worse than
  the current generous single-page fetches. See repo README "Phase 11 status" for full detail.
- 2026-08-06: Phase 12 in progress — Firebase project, Google Sign-In (real OAuth clients + native SDK,
  replacing the Phase 3 stub), release signing keystore, and production `API_BASE_URL`/`APP_ORIGIN`
  (`https://www.batamart.com`, catching a `www`-redirect gotcha) all wired up. A systematic nav-graph
  audit against `WEB_PAGES_REFERENCE.md` found and fixed 3 real wiring bugs (stale Become-Seller stub
  buttons, payment-success routing to the wrong tab, missing Cart tap targets). A performance audit
  found and fixed 3 issues: no image caching anywhere (`cached_network_image` added), two unvirtualized
  lists, and two home-shell widgets rebuilding entirely on every provider change instead of just their
  nav badge. Privacy policy drafted (`docs/PRIVACY_POLICY.md`). Hit and fixed two real environment
  problems building the release AAB (disk space, Gradle network timeouts) — see repo README "Phase 12
  status" for full detail. Still open: backend-side CSRF/FCM fixes (out of this repo's scope), manual
  on-device QA walkthrough, and Play Store screenshots (both need a real device/emulator run).
