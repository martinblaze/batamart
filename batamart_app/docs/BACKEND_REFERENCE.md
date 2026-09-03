# Batamart Backend API Reference (for the Flutter client)

This document is the API contract between the Flutter mobile app (`mobile/batamart_app/`) and the
existing Next.js backend (repo root, `app/api/**/route.ts`, Prisma + PostgreSQL). It was compiled by
reading the actual route source (not inferred from filenames) as of 2026-08-01. There is **no separate
backend for mobile** — the app calls the same `/api/*` routes the web app uses, against the same
database.

If a request/response shape here ever disagrees with what the live API actually does, trust the API
(test it) over this doc, and flag the mismatch — this is a snapshot, not a spec the backend is
contractually bound to.

Admin-only routes (`/api/admin/**`), cron routes (`/api/cron/**`), and `/api/test-db-speed` are out of
scope and not documented here.

---

## 1. Auth & Base Setup

### 1.1 Base URL

Not hard-coded anywhere in this doc — configure per environment (e.g. `https://<deployed-domain>` in
production, `http://<lan-ip>:3000` for local dev against `next dev`). All paths below are relative to
that base, e.g. `POST {baseUrl}/api/auth/login-with-password`.

### 1.2 Auth flow

- Login/signup endpoints return a JWT **in the JSON response body** as `token` (not only a cookie — this
  is deliberate, so non-browser clients can use it). None of the auth routes set a cookie for a Bearer
  client; store the token yourself.
- Store the token in `flutter_secure_storage`. Send it on every authenticated request as:
  `Authorization: Bearer <token>`.
- JWT payload: `{ userId: string, phone: string | null, role?: string }`, signed with `JWT_SECRET`,
  30-day expiry for normal users (`generateToken(userId, phone, role?, '30d')`), **90-day expiry for
  riders** (`riders/login` explicitly passes `'90d'`). Only rider tokens reliably carry a `role` claim —
  regular login/signup tokens are signed without a `role` claim (`generateToken(user.id, user.phone)`),
  so don't rely on decoding the JWT client-side to know the role; always use `/api/auth/me` (or the
  `user` object returned at login) as the source of truth for `role`/`isSellerMode`.
- Almost every route reads the user via `getUserFromRequest(request)` (`lib/auth/auth.ts`), which checks
  the `Authorization: Bearer <token>` header first, then falls back to a `token`/`adminToken` cookie —
  the cookie path is irrelevant to a Bearer-only mobile client. A handful of routes
  (`reviews/*`, `disputes/[id]/*`) use a locally-duplicated equivalent (`getUserFromToken`) with the same
  Bearer-header contract; a few (`auth/me`, `auth/update-profile`) read/verify the header manually. None
  of this changes the client contract — always send `Authorization: Bearer <token>`.

### 1.3 The same-origin gotcha (real integration blocker)

`lib/security/request.ts` exports `enforceSameOrigin(req)`, applied to non-GET routes. It is a CSRF guard
built for the **browser/cookie** threat model:

```ts
export function enforceSameOrigin(req: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(req.method)) return null           // GET/HEAD/OPTIONS always pass
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) return null   // Bearer requests are exempt
  const origin = normalizeOrigin(req.headers.get('origin'))
  const referer = normalizeOrigin(req.headers.get('referer'))
  const allowed = allowedOrigins()   // NEXT_PUBLIC_APP_URL, VERCEL_URL, http://localhost:3000, + host origin
  const candidate = origin || referer
  if (!candidate || !allowed.has(candidate)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  return null
}
```

**Any request that already carries `Authorization: Bearer <token>` is exempt.** That covers essentially
every authenticated call the app makes. The problem is the small set of routes that, by definition, are
called **before** the client has a token — a mobile HTTP client (`http`/`dio`) typically sends neither an
`Origin` nor `Referer` header, so `candidate` is `null` and the check fails closed with `403 { error:
'Invalid request origin' }`.

**Confirmed routes that call `enforceSameOrigin` and have no Bearer token available at call time (real
blocker):**

| Route | Notes |
|---|---|
| `POST /api/auth/login-with-password` | |
| `POST /api/auth/send-otp` | |
| `POST /api/auth/reset-password` | |
| `POST /api/riders/login` | |
| `POST /api/riders/register` | |

**Confirmed NOT affected** (no `enforceSameOrigin` call in the file at all, verified by reading each
route): `POST /api/auth/signup-with-password`, `POST /api/auth/verify-otp`, `POST /api/auth/google`.
Every other route that calls `enforceSameOrigin` requires a Bearer token to do anything useful anyway
(e.g. `update-profile`, `become-seller`, `payments/initialize`, `wallet/withdraw`, `upload`,
`products/[id]/report`), so the Bearer exemption fully covers them once the user is logged in.

**Fix options (pick one, this is a backend decision, not something the Flutter app can safely work
around alone):**
1. **Recommended:** remove the `enforceSameOrigin` call from the 5 routes above, mirroring
   `signup-with-password`/`verify-otp`/`google`, which already omit it. These routes are already
   protected by their own logic (password check, OTP code, rate limiting) — the CSRF guard is redundant
   for them and inconsistent with the sibling auth routes that already skip it.
2. Add a mobile-specific allowance to `allowedOrigins()` in `lib/security/request.ts` — e.g. accept a
   custom header (`X-App-Origin: batamart-mobile` or similar) as an alternative to `Origin`/`Referer`.
3. **Client-side workaround, no backend change, fragile:** manually set the `Origin` header on these 5
   calls to match the deployed `NEXT_PUBLIC_APP_URL` value (i.e., pretend to be the website). This works
   today but silently breaks if the allowed-origin env var changes, and some HTTP stacks restrict setting
   `Origin` manually. Treat as a stopgap, not a real fix.

Until one of these lands, expect `login-with-password`, `send-otp`, `reset-password`, `riders/login`, and
`riders/register` to potentially 403 from a bare mobile client.

### 1.4 Detecting role / isSellerMode

Call `GET /api/auth/me` after login (or on app start with a stored token) — see §4.1 for the full
response shape. Key fields: `role` (`"BUYER" | "SELLER" | "RIDER" | "ADMIN"`), `isSellerMode` (boolean —
only meaningful when `role === "SELLER"`; controls whether the seller-mode UI is active),
`isRiderVerified`/`isAvailable` (riders only), `hasWithdrawalPin` (boolean, derived — never returns the
actual PIN or its hash).

Role upgrade path: every signup is created as `BUYER`. `POST /api/auth/become-seller` is a one-time,
one-way change of `role` from `BUYER` to `SELLER` (idempotent if already a seller; blocked for
`RIDER`/`ADMIN`). After that, `POST /api/auth/toggle-seller-mode` flips the `isSellerMode` boolean back
and forth (requires `role` to already be `SELLER`/`ADMIN`) — this is how the app switches between "buyer
view" and "seller view" without changing the underlying role. Riders are a fully separate account
creation path (`POST /api/riders/register`), never converted from a buyer/seller account.

### 1.5 Rider gating — what actually matters for a mobile client

`middleware.ts`'s `RIDER_ALLOWED_PAGES`/`RIDER_ONLY_PAGES`/forced-logout logic is **page-routing** for
the web app only — it does not run against `/api/*` at all (the matcher excludes API routes except
`/api/admin/:path*`). The real gate for a Flutter client hitting the API directly is inside each route
handler. Every rider-only route (`/api/riders/toggle-availability`, `/live-location`, `/update-status`,
`/available-orders`, `/accept-order`, `/decline-oversized`, `/dispute-picked-up`, `/my-deliveries`) does
its own explicit check: `if (!user || user.role !== 'RIDER') return 401`. Conversely, nothing stops a
`RIDER`-role account from calling ordinary buyer/seller endpoints server-side (e.g. `GET /api/products`)
— the wall is enforced by convention (riders never got a UI for it on web) rather than a blanket
role-based API gate, except where individually coded. `login-with-password` and `google` auth both
explicitly reject `role === 'RIDER'` accounts (`403 { error: 'Rider accounts cannot log in here.',
isRider: true }`) — riders must use `POST /api/riders/login`.

---

## 2. Data Model Reference

Concise, app-developer-focused. Full canonical source is `prisma/schema.prisma`; only fields/relations
that matter for shaping API payloads are listed. Money fields are a **mix of `Float` and `Decimal(12,2)`**
— note which is which per model, since rounding behavior differs server-side.

**Correction (found during Flutter build, verified against actual route source — this doc previously said
JSON serializes both as plain numbers, which is wrong):** `Decimal` fields serialize to a JSON **string**
(e.g. `"0.00"`), not a number, *unless* the route explicitly converts with `Number(...)` server-side.
Checked every route that returns `User.pendingBalance`/`availableBalance` (the only two `Decimal` fields
in the schema): `GET /api/wallet` does the `Number(...)` conversion — safe to parse as numeric. `GET
/api/auth/me` and `POST /api/riders/login` do **not** — their `pendingBalance`/`availableBalance` arrive
as strings. A client-side `as num?`/`as double` cast on those two routes' responses throws (`type
'String' is not a subtype of type 'num?'`). Parse defensively (accept either `num` or `String`) for any
field sourced from a `Decimal` column, rather than trusting a given route's shape without checking.

- **User** — `id, phone (unique), email? (unique), password, matricNumber?, name, profilePhoto?, role
  (BUYER|SELLER|RIDER|ADMIN), isSellerMode (bool, default true), hostelName?, roomNumber?, landmark?,
  bio?, trustLevel (BRONZE|SILVER|GOLD|VERIFIED), avgRating (Float), totalReviews, completedOrders,
  penaltyPoints, isSuspended, suspendedUntil?, warningCount, lastWarningAt?, suspensionReason?,
  pendingBalance (Decimal 12,2), availableBalance (Decimal 12,2), isRiderVerified, riderIdDocument?,
  isAvailable (rider online/offline), referralCode (unique), referredById?, withdrawalPin? (bcrypt hash,
  never returned raw), withdrawalPinAttempts, withdrawalPinLockedUntil?, flutterwaveCustomerId?,
  universityId?`. `isSellerMode` and `role` are independent — see §1.4.
- **University** — `id, name (unique), shortName (unique), slug (unique), location, isActive,
  deliveryAreas (Json), hostels (Json)`. Source of the signup picklists for `landmark`/`hostelName`; the
  route that serves it (`GET /api/universities`) passes `deliveryAreas`/`hostels` through as raw JSON
  without asserting their internal shape.
- **DeliveryZone** — `id, universityId, name, isActive`. A named campus pickup/drop-off area (e.g.
  "Aroma"), matched **case-insensitively by name** against `User.landmark` / `Product.landmark` — there
  is no foreign key from User/Product to DeliveryZone, only string matching.
- **DeliveryRoute** — `id, zoneAId, zoneBId, price (Float), isActive`. A bidirectional priced link
  between two zones; `[zoneAId, zoneBId]` ordering is arbitrary, lookups check both orderings.
- **Product** — `id, name, description, price (Float, displayed/effective price), basePrice? (Float, raw
  submitted price before variant override), images (String[] — NOT a relation), category, categoryKey?,
  quantity, hostelName, roomNumber, landmark, sellerId, isActive, viewCount, avgRating, totalReviews,
  moderationStatus (PENDING|UNDER_REVIEW|APPROVED|REJECTED|REMOVED, default PENDING),
  rejectionReason?, estimatedWeightKg?, dimensionsCm? (Json), universityId?, subcategory?,
  subcategoryKey?, variantsEnabled (bool), marketPrice? (Float — last confirmed campus sale price for
  this product fingerprint), discountPercent? (Int, null = not a deal), isDeal (bool), nameKey?
  (normalised name for market-price matching), variantKey? (price-sensitive fingerprint), conditionType?
  ("NEW"|"USED"|"REFURBISHED", free string not an enum), hasChangedParts, isHot, hotReason? ("VIEWS" |
  "DEAL" | "BOTH"), hotScore, isFlagged, flagReason?, campaignTag? (free string, reused across future
  promos — e.g. `"GIRLFRIENDS_DAY"`), campaignExpiresAt?`. New products always start `moderationStatus:
  PENDING, isActive: false` — invisible in listings until some admin process approves them (not covered
  by any route in this doc).
- **ProductVariant** — `id, productId, combination (Json, e.g. {"color":"Blue","storage":"128GB"}), price
  (Float), stock, sku?, imageUrl?`.
- **ProductAttributeValue** — `id, productId, key, label, value (Json), searchable, filterable` — dynamic
  per-product attribute values (brand, RAM, etc.).
- **CategoryAttribute** — `id, categoryKey, subcategoryKey?, key, label, type, options? (Json),
  required, filterable, searchable, sortOrder` — the schema definition of what attributes a category
  supports; also auto-grows via learned `AttributeSuggestion`/`AttributeValueStats` when sellers submit
  new attribute keys often enough (≥10 occurrences auto-promotes).
- **Cart / CartItem** — exist in the schema (`Cart.userId` unique, `CartItem{cartId, productId,
  quantity}`) but **no route in the app reads or writes them** (verified — `app/api/cart/` contains only
  `add/route.ts`, which is a stateless price/stock validator, not a cart CRUD API). Treat cart state as
  entirely client-side; see §4.4.
- **Order** — `id, orderNumber (unique), buyerId, sellerId, productId, riderId?, productPrice (Float),
  deliveryFee (Float), totalAmount (Float), platformCommission (Float, default 0), quantity,
  deliveryHostel, deliveryRoom, deliveryLandmark, deliveryPhone, status (OrderStatus), orderedAt,
  riderAssignedAt?, pickedUpAt?, deliveredAt?, completedAt?, isPaid (bool), isDisputed (bool),
  disputeReason?, orderNote?, buyerDeliveryAcknowledged (bool), oversizedCancellationReason?, campaignTag?
  (snapshot of the product's campaign tag at purchase time — permanent, never re-derived from the live
  Product even if the product's tag later changes/expires), batchId?`. `OrderStatus` enum: `PENDING,
  PROCESSING, SHIPPED, RIDER_ASSIGNED, PICKED_UP, ON_THE_WAY, DELIVERED, COMPLETED, DISPUTED, CANCELLED`
  (note `SHIPPED` and `DISPUTED` exist in the enum but are not part of the normal rider/buyer transition
  chain used by the real routes — see §5.7).
- **OrderItem** — `id, orderId, productId, variantId?, variantData? (Json snapshot), quantity, price` —
  the real line-item breakdown for multi-item orders (an `Order` row is per-**seller**, not per-product;
  `OrderItem` is per-product-within-that-seller's-order).
- **DeliveryBatch** — `id, batchNumber (unique), buyerId, riderId?, universityId, paymentReference?,
  referralPaid (bool), status (PENDING|RIDER_ASSIGNED|IN_PROGRESS|COMPLETED)`. One buyer checkout across
  N sellers → 1 `DeliveryBatch` + N `Order` rows (one per seller "leg"), all sharing the batch id and the
  same `paymentReference` (the payment gateway's `tx_ref`).
- **Payment** — `id, orderId (unique), amount (Float), method (CARD|BANK_TRANSFER|WALLET|ESCROW), status
  (PENDING|PROCESSING|COMPLETED|FAILED|REFUNDED), transactionId? (unique — the gateway tx_ref),
  gatewayResponse? (Json), paidAt?, refundedAt?, refundAmount?, refundReason?`. One `Payment` per `Order`
  (i.e. per seller leg), even though one checkout charge covers the whole batch.
- **Transaction** — `id, userId, type (CREDIT|DEBIT|ESCROW|WITHDRAWAL|REFERRAL_REWARD), amount,
  description, reference?, balanceBefore, balanceAfter, createdAt`. This is the wallet ledger — see §5.2
  for exactly which rows get created at which stage of an order's life.
- **WithdrawalRequest** — `id, userId, clientRequestId? (unique, idempotency key), amount, bankDetails
  (Json: bankCode/accountNumber/accountName/status/transferReference/transferCode/flutterwaveStatus),
  status (PENDING|PROCESSING|COMPLETED|REJECTED), adminNotes?, processedAt?, processedBy?`.
- **Review** — person review (seller or rider), `rating (1-5), comment?, orderId, reviewerId, revieweeId,
  type (SELLER|RIDER)`, unique on `[orderId, type, reviewerId]`.
- **ProductReview** — separate model, product review, `rating (1-5), comment, orderId, productId,
  reviewerId`, unique on `[orderId, productId, reviewerId]`. Never combined with `Review` in one request
  — always two separate submissions.
- **Dispute** — `id, orderId (unique), buyerId, sellerId, reason, buyerEvidence (String[]),
  sellerEvidence (String[]), status (OPEN|UNDER_REVIEW|RESOLVED_BUYER_FAVOR|RESOLVED_SELLER_FAVOR|
  RESOLVED_COMPROMISE|DISMISSED), resolution? (also used internally as an sentinel/state string during
  the return flow — see §5.7), refundAmount?, resolvedAt?, resolvedBy?, pickupAddress? (Json),
  resolutionPreference? (default `'REFUND_WITH_PICKUP'`)`.
- **DisputeMessage** — `id, disputeId, senderId, senderType ("BUYER"|"ADMIN"|legacy "SELLER"), message,
  attachments (String[] of already-uploaded URLs)`.
- **Report** — generic user-submitted report (product/seller/rider/buyer), `type
  (PRODUCT|SELLER|RIDER|BUYER), reason (enum, 9 values, see §4.9), description, evidence (String[]),
  reporterId, reportedUserId?, reportedProductId?, reportedOrderId?, status
  (PENDING|UNDER_REVIEW|RESOLVED|DISMISSED), disputeId? (unique — set later by an admin action, never by
  the client route)`. Purely informational for admin review — does **not** auto-create a `Dispute` or
  `Penalty`.
- **Penalty** — admin/system-issued, `userId, action (WARNING|TEMP_BAN_1DAY|TEMP_BAN_3DAYS|
  TEMP_BAN_7DAYS|TEMP_BAN_30DAYS|PERMANENT_BAN|TRUST_LEVEL_DOWNGRADE), reason, pointsAdded, reportId?,
  disputeId?, bannedUntil?, issuedBy?`. No route in this doc's scope directly creates these (admin-only).
- **SellerStrike** — `sellerId, productId?, orderId?, strikeCount, reason, suspensionReason?,
  suspensionExpiry?`. Created automatically by the oversized-decline flow (§5.9) — 2nd strike = 3-day
  suspension, 3rd = 14-day, 4th+ = permanent.
- **OversizedDeclineLog** — `orderId, productId, sellerId, riderId, buyerId, reason, proofImageUrl?,
  refundIssued, refundAmount?, deliveryFeeKept`, unique on `[orderId, riderId]`.
- **Notification** — `userId, type (large enum, 27 values — see §4.10), title, message, orderId?,
  productId?, disputeId?, reportId?, reviewId?, metadata? (Json), isRead, readAt?, referralRewardId?`.
- **PushSubscription** — Web Push (VAPID-style) subscription: `endpoint (unique), p256dh, auth, userId`.
  This is browser Web Push, not FCM/APNs — see §4.10 note on relevance to a native mobile client.
- **ReferralReward** — `referrerId, referredUserId, orderId (unique), amount, createdAt`.
- **PendingCharge** — `userId, reference (unique), chargeId, amount, cartItemsJson, status
  (PENDING|PROCESSED)`. Schema comment describes this as bridging a Flutterwave **v4** charge flow, but
  the actual checkout routes read in this pass (`payments/initialize`/`verify`) use Flutterwave **v3**
  hosted checkout (`/v3/payments` + redirect + `/v3/transactions/{id}/verify`) and never touch
  `PendingCharge` at all — this table appears to be for a charge flow that isn't wired into the routes
  documented here. Don't design around it.
- **SearchLog** — fire-and-forget search analytics (`query, category?, resultCount, clickedId?`),
  written by `GET /api/products` when a search query is present; read back by `GET
  /api/search/suggestions?type=popular`.
- **AppSetting** — `key (id), value (bool)`. Only confirmed key in these routes:
  `checkout_payments_enabled` — a single global (not per-university) kill switch for checkout, read by
  `GET /api/payment-availability` and enforced inside `POST /api/payments/initialize`.
- **SupportTicket** — `name, email, message, category (enum, 8 values), userId?, status
  (OPEN|IN_REVIEW|RESOLVED|CLOSED), adminNotes?, resolvedAt?`.
- **UserSessionEvent** — anonymous/authenticated analytics: `userId?, sessionId, productId?, eventType
  ("view"|"click"|"search"), meta? (Json)`. Feeds `ProductCoView` and the `people-like-you` feed.
- **ProductCoView** — `productId, relatedProductId, count` — "viewed X also viewed Y" counters built from
  `UserSessionEvent`.
- **MarketPrice** — one row per completed order (`orderId` unique), records the confirmed sale price for
  a product fingerprint (`nameKey, variantKey?, category, condition, hasChangedParts`) — feeds the
  isDeal/discountPercent/isHot computation elsewhere.

---

## 3. API Endpoint Reference

Unless stated otherwise, every non-GET request should be sent with `Content-Type: application/json`
(`enforceJsonRequest` rejects anything else with `415` on the routes that check it). All responses below
are JSON unless marked otherwise. Error shapes generally follow `{ error: string }` — additional fields
are called out per-route where the server sends extra machine-readable detail (e.g. `blockReason`).

### 3.1 Auth (`/api/auth/*`)

None of these routes set cookies for a Bearer client — the token is only ever returned in the JSON body.

#### `POST /api/auth/login-with-password`
- Auth: none (this establishes it). ⚠ Subject to the same-origin gotcha, §1.3.
- Rate limit: 10 / 15 min per IP.
- Body: `{ email: string, password: string }`
- 200: `{ success: true, token: "<jwt>", user: { id, name, phone, email, role, hostelName } }`
- Errors: `400` missing fields; `404` account not found; `403 { error, isRider: true }` if the account is
  a rider; `401` wrong password; `403 { error: 'Account suspended', suspended: true, reason, until }`;
  `429` rate limited (`Retry-After` header).

#### `POST /api/auth/signup-with-password`
- Auth: none. Not subject to the same-origin gotcha (no `enforceSameOrigin` call in this file).
- Rate limit: 5 / hour per IP.
- Body: `{ email, name (2-80 chars), password (6-128 chars), otpSessionToken, phone, universityId,
  hostelName, roomNumber, landmark, referralCode? }`. `otpSessionToken` comes from either
  `verify-otp` (email OTP flow) or from `google` auth's `signupToken` (interchangeable — both are
  accepted). Any `role` field in the body is ignored; all signups are created as `BUYER`.
- 200: `{ success: true, token, user: { id, name, phone, email, role: "BUYER", hostelName, roomNumber,
  landmark, referralCode, universityId, university: { name, shortName } } }`
- Errors (`400` unless noted): missing required fields; per-field validation messages (university not
  selected/inactive, hostel/room/landmark empty, name/password length); `otpSessionToken`
  invalid/expired → `'Session expired or invalid. Please restart signup.'`; email in token doesn't match
  submitted email; duplicate email/phone; `429` rate limited; `500` generic.

#### `POST /api/auth/send-otp`
- Auth: none. ⚠ Same-origin gotcha, §1.3.
- Rate limit: 5 / 15 min per IP.
- Body: `{ email: string, isLogin?: boolean }`. If `isLogin` is true, the email must already have an
  account (`404` if not); if false/omitted, the email must NOT already exist (`400` if it does).
- Sends a 6-digit numeric code, single-use, 10-minute TTL, via Resend (or logs to console server-side if
  `RESEND_API_KEY` is unset — irrelevant to the client, just a dev-mode note).
- 200: `{ success: true, message: 'Verification code sent to your email' }`
- Errors: `400`/`404` per above; `500` if the email provider send fails; `429` rate limited.

#### `POST /api/auth/verify-otp`
- Auth: none. Not subject to the same-origin gotcha.
- Rate limit: 15 / 15 min per `ip:identifier`.
- Body: `{ phone?: string, email?: string, code|otpCode: string, name?: string }` — one of phone/email
  required; `otpCode` key wins if both `code` and `otpCode` are present.
- **Two behaviors depending on `name`:**
  - No `name` (signup flow): `200 { success: true, otpSessionToken: "<jwt, 15m>" }` — pass this straight
    into `signup-with-password`'s `otpSessionToken`.
  - `name` present (passwordless login flow): finds-or-creates a user (new users get `password: ''` —
    **cannot** subsequently log in via `login-with-password` until a real password is set some other
    way), returns a full login token: `200 { success: true, token, user: { id, name, phone, email,
    hostelName } }` (no `role` field in this branch's `user` object).
- Errors: `400` missing code / missing identifier / invalid-or-expired OTP; `429` rate limited.
- ⚠ **Do not call this before `reset-password`** — see the OTP-reset sequence note under that route.

#### `POST /api/auth/google`
- Auth: none (establishes it). Not subject to the same-origin gotcha.
- Body: `{ idToken: string, mode?: string (e.g. 'signup'), universityId?, referralCode?,
  signupAccessCode? }`. **`idToken` must be a Google-issued ID token** (native Google Sign-In SDK), not
  an access token — verified server-side against Google's live JWKS with issuer/audience checks
  (audience must match the configured `GOOGLE_CLIENT_ID`).
- Behavior:
  - No existing user + `mode !== 'signup'` → `404 { error: 'No account found. Use Sign up with Google
    first.' }` (does not auto-create accounts on a plain login attempt).
  - No existing user + `mode === 'signup'` → `200 { success: true, requiresProfile: true, signupToken:
    "<jwt, 15m>", profile: { email, name } }`. This does **not** create a user yet — the client must
    then call `signup-with-password` with `otpSessionToken: signupToken` plus the rest of the normal
    signup fields (password, university, hostel, etc.) to actually persist the account.
  - Existing user, `role === 'RIDER'` → `403 { error, isRider: true }`.
  - Existing user, suspended → `403 { error: 'Account suspended', suspended, reason, until }`.
  - Existing user, otherwise → `200 { success: true, token, user: { id, name, phone, email, role,
    hostelName } }`.
- Errors: `400` no email on Google account; `500` on any verification failure (bad/expired idToken, wrong
  audience).

#### `POST /api/auth/reset-password`
- Auth: none. ⚠ Same-origin gotcha, §1.3.
- Rate limit: 5 / 15 min per IP (note: the rate-limit counter increment appears to be missing in this
  route's code — don't rely on this limit being strictly enforced).
- Body: `{ email: string, otpCode: string, newPassword: string }`
- ⚠ **Correct sequence: `send-otp` → (user reads the 6-digit code) → `reset-password` directly.** This
  route re-validates the raw `otpCode` itself against the `OTP` table (same single-use mechanism as
  `verify-otp`) — it does **not** accept a session token. If you call `verify-otp` first, it will consume
  the OTP and `reset-password` will then fail with `400 'Invalid or expired OTP'`. Skip `verify-otp`
  entirely for password-reset.
- 200: `{ success: true, message: 'Password reset successful' }`
- Errors: `400` missing fields / invalid-or-expired OTP; `404` account not found; `429`; `500`.

#### `GET /api/auth/me`
- Auth: Bearer required (manual header parse, no cookie fallback). `401` if missing/invalid.
- Auto-lifts an expired suspension before responding; if still suspended → `403 { error: 'Account
  suspended', suspended: true, reason, until }` (note: `suspensionReason` is fetched but **not** included
  in the success body, only in this 403 branch).
- 200:
```json
{
  "user": {
    "id": "...", "name": "...", "phone": "...", "email": "...",
    "matricNumber": "...", "profilePhoto": "...",
    "role": "BUYER", "isSellerMode": true,
    "hostelName": "...", "roomNumber": "...", "landmark": "...",
    "trustLevel": "BRONZE",
    "rating": 4.7, "totalRatings": 12, "completedOrders": 5,
    "pendingBalance": 0, "availableBalance": 15000,
    "penaltyPoints": 0,
    "isSuspended": false, "suspendedUntil": null,
    "isRiderVerified": false, "isAvailable": true,
    "hasWithdrawalPin": true,
    "createdAt": "...", "updatedAt": "...",
    "universityId": "...",
    "university": { "id": "...", "name": "...", "shortName": "...", "slug": "...", "location": "...", "deliveryAreas": [], "hostels": [] }
  }
}
```
  Note the field **renames** vs. the DB: `avgRating` → `rating`, `totalReviews` → `totalRatings`,
  `withdrawalPin` (string/null) → `hasWithdrawalPin` (bool).
- Errors: `401`; `500`.

#### `PUT /api/auth/profile`
- Auth: Bearer required (`getUserFromRequest`). `401` if missing.
- Body: `{ hostelName, roomNumber, landmark }` — all three required (truthy check). `400 { error: 'All
  fields are required' }` otherwise.
- 200: `{ success: true, user: { id, name, hostelName, roomNumber, landmark } }`
- This is a narrower duplicate of `update-profile` (delivery-location fields only). Prefer
  `update-profile` below for a Flutter client since it's more complete and zod-validated.

#### `PATCH /api/auth/update-profile`
- Auth: Bearer required (manual header + `verifyToken`). `401 { error: 'Unauthorized' }` (no header) or
  `401 { error: 'Invalid token' }` (bad token).
- Body (zod, `.strict()` — unknown keys rejected with `400 { error: 'Invalid profile payload' }`), all
  optional, partial update:
  `{ name?: string (1-80), phone?: string (10-20), hostelName?: string|null (≤120), roomNumber?:
  string|null (≤40), landmark?: string|null (≤200) }`
- `phone`, if provided, is stripped to digits only and must be 10–11 digits (`400 { error: 'Invalid phone
  number' }` otherwise); stored as raw digits — **not** normalized to `+234...` like other routes'
  `formatPhone`.
- 200: `{ user: { id, name, email, phone, hostelName, roomNumber, landmark, role, isSellerMode } }`
- Errors: `401` (both variants); `400` (zod or phone format); `500`.

#### `POST /api/auth/toggle-seller-mode`
- Auth: Bearer required. Role gate: only `role === 'SELLER'` or `'ADMIN'` — else `403 { error: 'Not
  authorized' }`.
- Body: `{ isSellerMode: boolean }` (sent as-is, no type coercion).
- 200: `{ success: true, user: { id, name, role, isSellerMode } }`
- Only flips `isSellerMode` — never touches `role`. See §1.4.

#### `POST /api/auth/become-seller`
- Auth: Bearer required. `403` if `role` is `RIDER` or `ADMIN` (`"Role RIDER cannot self-upgrade to
  SELLER"`, role interpolated).
- Already a seller → idempotent `200 { success: true, message: 'You are already a seller.' }` (no `user`
  key, no DB write).
- Otherwise sets `role: 'SELLER'` → `200 { success: true, message: 'You are now a seller!', user: { id,
  name, role: 'SELLER' } }`
- See §1.4 for the full become-seller vs. toggle-seller-mode distinction.

#### `GET /api/auth/suspension-info`
- Auth: **soft-checked, never hard-401s.** No/invalid `Authorization` header → `200 { isSuspended: true,
  reason: null, until: null }` (a conservative fallback — **not proof of actual suspension**, just a safe
  default when the caller can't be identified). Valid token → `200 { isSuspended, reason, until }`
  reflecting the real DB state (auto-lifts an expired suspension first). Any internal error also falls
  back to `200 { isSuspended: true, reason: null, until: null }` (never a `500`).
- Does **not** return `warningCount` or `penaltyPoints` (schema fields exist but aren't exposed here;
  `penaltyPoints` is exposed by `/api/auth/me` instead). Treat `/api/auth/me`'s `403` body, or
  `login-with-password`/`google`'s `403` body, as the authoritative suspension source — this route is a
  best-effort fallback only.

---

### 3.2 Universities / Onboarding

#### `GET /api/universities`
- Auth: none.
- 200: `{ universities: [{ id, name, shortName, slug, location, deliveryAreas, hostels }] }` — only
  `isActive: true` universities, ordered by name. `deliveryAreas`/`hostels` are raw `Json` (this route
  doesn't assert their internal array/object shape — inspect actual data before assuming a structure).
  This is the picklist source for signup's university/hostel/landmark selectors.
- Errors: `500`.

---

### 3.3 Products & Search

#### `GET /api/products` — list/search
- Auth: Bearer required + `user.universityId` must be set (`403` otherwise) — listings are always scoped
  to the caller's own university.
- Query params (all optional): `categoryKey`|`category`, `subcategoryKey`|`sub`, `sellerId`, `hostel`
  (contains match, `'All'` ignored), `zone` (exact match on `landmark`, `'All'` ignored), `campaignTag`
  (validated against the known campaign-key list), `q`|`search`, `sortBy`|`sort`
  (`relevance`(default)|`newest`|`price_asc`/`priceLow`|`price_desc`/`priceHigh`|`rating`|`popular`),
  `minPrice`, `maxPrice`, `minRating`|`rating`, `inStock=true`, `delivery=fast` (in-memory text match on
  `deliveryEstimate`, capped to scanning 1000 rows), `page` (default 1), `limit` (default 40, max 100),
  `attributes` (JSON string `{"key": "value"|["v1","v2"]}`), plus any unrecognized query key is treated
  as an ad-hoc attribute filter.
- Hard filter always applied: `isActive: true, isDeleted: false, moderationStatus: 'APPROVED',
  universityId: user.universityId`.
- 200: `{ success: true, products: [...], count, total, page, limit, pages, hasMore }`. Each product
  includes `seller: { id, name, avgRating, trustLevel, completedOrders }`, full `variants`, full
  `attributeValues`, `_count: { orders }`, and `category`/`subcategory` re-hydrated to display labels.
- Side effect: if `q`/`search` was non-empty, fire-and-forget logs a `SearchLog` row.
- Errors: `401`, `403` (no university), `500`.

#### `POST /api/products` — create listing
- Auth: Bearer required. **No explicit seller-role or `isSellerMode` check in this route** — any
  authenticated user with a `universityId` can call it; seller-only enforcement is a client-side/UI
  convention, not a server gate.
- Body:
  - Required: `name`, `price` (0 < p ≤ 10,000,000), `category`, `quantity` (int 1–100),
    `productDeliveryAgreement: true` (must literally be boolean true, else `400 'You must confirm
    motorcycle delivery suitability before listing.'`).
  - Optional: `description` (≤5000), `categoryKey`, `subcategory`, `subcategoryKey`, `images: string[]`,
    `hostelName`/`roomNumber`/`landmark` (default to the seller's own profile values if omitted),
    `estimatedWeightKg`, `dimensionsCm` (Json), `deliveryEstimate` (≤80 chars), `campaignTag` (validated;
    sets `campaignExpiresAt` automatically if valid).
  - `variants?: [{ combination: object, price: number (0-10,000,000), stock: int (0-100), sku?, imageUrl?
    }]` — if any entry is invalid the whole request `400`s. If provided and non-empty:
    `variantsEnabled: true`, stored `price` = min variant price, stored `quantity` = sum of variant
    stocks.
  - `attributes?: [{ key, label?, value, searchable?, filterable? }]` — stored as `ProductAttributeValue`
    rows; also feeds the auto-learning pipeline (`AttributeSuggestion`/`AttributeValueStats`,
    auto-promotes to a real `CategoryAttribute` after ≥10 occurrences of a safe key).
- Pre-check: name/description/category/attributes/variants/deliveryEstimate scanned against a banned
  content/keyword list — match → `422 { error: 'Your listing was rejected. It contains prohibited
  content.' }`.
- **Every new product is created `moderationStatus: 'PENDING', isActive: false`** — invisible in
  `GET /api/products` until approved by a process outside these routes.
- 201: `{ success: true, product: { ...full row incl. variants, attributeValues... } }`
- Errors: `401`, `403` (no university), `400` (validation), `422` (banned content), `500`.

#### `GET /api/products/{id}`
- Auth: **none required** — publicly viewable (a shared link works for anonymous/cross-university
  visitors; purchasing is what's actually gated, not viewing). If `Authorization: Bearer
  <INTERNAL_API_SECRET>` matches the server's internal secret, treated as a crawler (`isInternal`,
  affects the view-count side effect below only).
- Filter: `{ id, isDeleted: false, isActive: true }` — **a pending/inactive product 404s even for its own
  owner** through this route; there's no owner override.
- 200: `{ product: { ...full row incl. variants, attributeValues, seller: { id, name, avgRating,
  trustLevel, completedOrders, profilePhoto, hostelName, roomNumber } } }`
- Side effect: for identifiable, non-internal, logged-in visitors only, unconditionally increments
  `viewCount` (no debounce, no session logging). This is a *different, cruder* counter than
  `POST /api/products/{id}/view` below — call the dedicated `/view` route explicitly from the
  product-detail screen instead of relying on this GET's side effect, to get proper
  debouncing/hot-status logic.
- Errors: `404`, `500`.

#### `PUT /api/products/{id}`
- Auth: Bearer required, must be the owner (`403 'Not authorized to edit this product'`). **No suspended
  check** on this route (unlike DELETE).
- Body (all optional, partial update): `name, price, description, category, categoryKey, subcategory,
  subcategoryKey, basePrice, variantsEnabled, images, hostelName, roomNumber, landmark, isActive
  (seller can pause/activate their own listing), quantity, deliveryEstimate, campaignTag` (falsy clears
  tag+expiry; valid sets both). Does **not** accept/change `moderationStatus` — a seller can't
  self-resubmit for approval here.
- 200: `{ success: true, product: {...}, message: 'Product updated successfully' }`
- Errors: `401`, `404`, `403`, `500`.

#### `DELETE /api/products/{id}`
- Auth: Bearer required, must be owner (`403`). Blocked if `user.isSuspended` (`403 'Suspended sellers
  cannot edit products.'`).
- Hard delete (`prisma.product.delete`, not a soft `isDeleted` flip).
- 200: `{ success: true, message: 'Product deleted successfully' }`
- Errors: `401`, `403`, `404`, `500`.

#### `GET /api/products/my-products`
- Auth: Bearer required. Returns **all** of the caller's own products regardless of
  active/moderation/deleted state (`where: { sellerId: user.id }` only).
- 200: `{ success: true, products: [...], stats: { total, active, outOfStock, inactive } }` —
  `active = isActive && quantity>0`, `outOfStock = quantity===0`, `inactive = !isActive`.
- Errors: `500`.

#### `POST /api/products/{id}/restock`
- Auth: Bearer required, must be owner (`403 'Not your product'`).
- Body: `{ quantity: number }` — **added** to existing stock (`product.quantity + quantity`), not a
  reset. Also force-sets `isActive: true` (reactivates a paused/out-of-stock listing) regardless of prior
  state. Does not touch `moderationStatus`. No upper-bound validation on the increment in this route.
- 200: `{ success: true, product: {...} }`
- Errors: `401`, `404`, `403`, `500`.

#### `POST /api/products/{id}/report`
- Auth: Bearer required (Bearer exempts the same-origin check; just send `Content-Type: application/json`).
- Body: `{ reason?: string }` (≤500 chars, trimmed).
- `400` if reporting your own listing. On success: creates a `ProductReport` row and flags the product
  (`isFlagged: true`, `flagReason` if given), in one transaction.
- 200: `{ success: true }`
- Errors: `401`, `400` (own listing), `404`, `409 { error: 'You have already reported this listing.' }`
  (duplicate report, unique constraint), `500`.

#### `GET /api/products/{id}/related`
- Auth: Bearer required + `user.universityId` (`403` if missing); `403` if the source product is in a
  different university than the caller.
- Multi-section recommendation payload — "Customers also bought" (order co-purchase), "Customers also
  viewed" (`ProductCoView`), "Similar products" (same subcategory, attribute Jaccard similarity), "Deals
  on related products", "More from {seller}", "More in this subcategory". All candidate queries hard-scope
  to `isActive: true, isDeleted: false, quantity>0, moderationStatus: 'APPROVED',
  universityId: source.universityId`. Sections only render if they have ≥2 items after cross-section
  dedup.
- 200:
```json
{
  "success": true,
  "sections": [ { "title": "...", "reason": "...", "products": [ /* RelatedProduct */ ] } ],
  "sourceProduct": { "id", "name", "categoryKey", "subcategoryKey", "seller": {...} },
  "related": { "nameRelated": [...], "others": [...], "grid": [...] }
}
```
  `RelatedProduct`: `{ id, name, price, priceDisplay (₦-formatted), images, avgRating, totalReviews,
  isHot, isDeal, discountPercent, seller: {...}, deliveryEstimate, matchReason? }`.
- Response header: `Cache-Control: public, s-maxage=300, stale-while-revalidate=300` (also on error
  responses).
- Errors: `401`, `403`, `404`, `500`.

#### `POST /api/products/{id}/view`
- Auth: effectively required for any effect — no user → `200 { ok: true, skipped: true }` (never errors
  to the client; fire-and-forget telemetry endpoint).
- Debounced 30 minutes per `userId:productId` (both in-memory and DB-backed via `UserSessionEvent`, so it
  survives server restarts). Self-views by the product's own seller are skipped.
- On a real (non-skipped) view: logs a `UserSessionEvent(eventType:'view')` and increments `viewCount`.
  If this increment crosses `viewCount >= 15` for the first time, asynchronously triggers hot-status
  re-evaluation.
- 200: `{ ok: true }` or `{ ok: true, skipped: true }` — always effectively 200, even on internal error.
- **Call this explicitly from the product-detail screen** — don't rely on the plain `GET` view-count side
  effect described above.

#### `GET /api/products/feed`
- Auth: Bearer required + `user.universityId` (`403` if missing). Rate-limited: 60 req/60s per IP → `429`
  with `Retry-After`.
- Query: `limit` (clamped 50–100, default 100), `zone?`, `categories`|`viewed` (comma list),
  `keywords`|`searched` (comma list), `categorySignals`|`keywordSignals` (JSON array of strings or
  `{value, timestamp?}` — preferred over the comma-list versions; `timestamp` enables time-decay
  weighting of client-supplied signals).
- **Personalization is entirely client-driven here** — no server-side history read (contrast with
  `people-like-you` below). No signals supplied → falls back to `0.6*popularity + 0.4*recency` scoring.
- 200: `{ success: true, products: [...], hotProducts: [...top 20...], forYouProducts: [...top 12...],
  newListings: [...top 12, ≤7 days old...], discoverProducts: [...up to 40...], meta: { usedFallback:
  bool } }`. Each product carries `minPrice, maxPrice, priceDisplay, score, popularityScore,
  recencyScore, isPersonalised, isNew, isHot, isDeal, discountPercent, marketPrice`. Result buckets are
  diversity-capped (max 3 per seller, 10 per category).
- Note: filters `isActive: true, quantity>0, isDeleted: false` but does **not** explicitly filter
  `moderationStatus: 'APPROVED'` in its where clause (functionally equivalent today since pending
  products are also inactive, but not a redundant safety net if that invariant ever changes).
- Errors: `401`, `403`, `429`, `500`.

#### `GET /api/products/people-like-you`
- Auth: Bearer required. No `universityId` → `200 { items: [], page: 1, hasMore: false, total: 0 }` (not
  an error).
- Query: `mode` (`'daily'`|`'top'`, default `'top'`), `page` (default 1), `pageSize` (max 40, default 20
  for daily / 12 for top), `daysBack` (clamped 14–180, default 120), `sessionId?`.
- **Personalization is derived entirely server-side** from: the caller's own past-order categories, all
  campus completed orders within `daysBack`, `UserSessionEvent` from the last 48h (own userId or given
  `sessionId`), and `ProductCoView` counts.
- 200:
```json
{
  "mode": "top", "page": 1, "pageSize": 12, "total": 47, "hasMore": true,
  "items": [ { "key", "dateKey", "score", "soldCount", "uniqueBuyers", "product": { "id","name","price","images","category","seller":{...} } } ],
  "generatedAt": "..."
}
```
- Errors: `401`, `500`.

#### `GET /api/search/suggestions`
- Auth: none.
- Query: `q?`, `type?` (`'popular'` → trending queries instead of product matches), `limit` (1–10,
  default 8).
- `type=popular`: `{ suggestions: [{ text, type: 'popular' }] }` from grouped `SearchLog`, falls back to a
  static hardcoded list on any query failure.
- Default (`q` given): `{ suggestions: [{ text, category?, type: 'product'|'category' }] }` — matches
  `Product.name`/`category`/`subcategory` (contains, insensitive; `isActive:true, isDeleted:false` only —
  **no `moderationStatus` or `universityId` filter** on this route specifically, though in practice moot
  since pending products are inactive) plus category-tree label matches.
- Errors: `500` still returns `{ suggestions: [] }` shape but with 500 status.

#### `GET /api/product-filters`
- Auth: Bearer required + `user.universityId` (`403` if missing).
- Query: `categoryKey`|`category`, `subcategoryKey`|`sub`, `q`|`search`, plus already-selected filter
  values (comma or JSON `attributes`).
- Computes available filter facets + counts for the current scope (`isActive:true, isDeleted:false,
  quantity>0, moderationStatus:'APPROVED', universityId` + category/search constraints), merging
  `ProductAttributeValue` data, `ProductVariant.combination` fields, and `CategoryAttribute` definitions.
- 200: `{ success: true, filters: [{ key, label, type ("select"|"multi_select"|"boolean"|"range"),
  source ("attribute"|"variant"|"merged"), options: [{ value, count }], selectedValues }], price: { min,
  max }, selectedValues: {...} }`
- Errors: `401`, `403`, `500`.

#### `GET /api/category-attributes`
- Auth: Bearer required.
- Query: `categoryKey` (required, else `400`), `subcategoryKey?`.
- Returns the dynamic attribute schema for a category (used to render the "add product" form's dynamic
  fields), with `select`/`multi_select` options hydrated from learned `AttributeValueStats` + variant
  field suggestions + a hardcoded brand fallback list for `key === 'brand'`.
- 200: `{ success: true, attributes: [{ ...CategoryAttribute fields..., options: [...] }] }`
- Errors: `401`, `400` (missing categoryKey), `500`.

#### `POST /api/parse-product`
- Auth: Bearer required.
- AI/heuristic-assisted parsing of free-form listing text (e.g. a seller pastes "iPhone 13 Pro Max
  256GB, ₦450,000, 2 units") into structured fields, to prefill the create-listing form. Actual field
  extraction logic lives in `lib/product-parser.ts` (not verified in this pass — treat the exact shape of
  `parsed` as unconfirmed until tested against the live API).
- Body: `{ text: string }` — empty/whitespace text short-circuits to `{ parsed: {} }` without invoking the
  parser.
- 200: `{ success: true, parsed: { /* unconfirmed shape */ } }`
- Errors: `401`, `500`.

---

### 3.4 Cart

**There is no server-side cart CRUD API.** `app/api/cart/` contains exactly one file,
`add/route.ts`, exporting only `POST`. Design the Flutter app's cart as fully client-local state (list of
`{productId, variantId?, quantity, orderNote?, buyerDeliveryAcknowledged?}`), and use the routes below to
validate/price it against the server:

#### `POST /api/cart/add`
- Auth: Bearer required.
- Body: `{ productId: string, quantity?: number (default 1, min 1), variantId?: string }`
- Purpose: re-fetch a **live, authoritative snapshot** of one product (current price, stock cap, seller)
  to reconcile into local cart state — not a persistence call. Product must be
  `isDeleted:false, isActive:true, quantity>0`, and (if the caller has a `universityId`) must match the
  caller's university.
- 200: `{ success: true, item: { productId, variantId, quantity, name, price, image, sellerId,
  sellerName, maxQuantity } }`
- Errors: `401`, `400` (missing productId), `404` (not found/unavailable/wrong campus), `500`.
- Call this opportunistically whenever an item is added to the local cart, and again right before
  checkout to catch price/stock drift; use `POST /api/delivery/quote` (§3.5) to preview delivery cost for
  the whole cart, and `POST /api/payments/initialize` to actually check out.

---

### 3.5 Checkout & Payments

Payment provider is **Flutterwave v3, hosted-checkout redirect flow** (`FLUTTERWAVE_BASE_URL =
https://api.flutterwave.com/v3`). There is no direct card-charge/webhook flow wired into these routes.

**Order creation timing:** orders are **not** created at `initialize` time — that call only computes
totals and returns a Flutterwave-hosted-checkout URL. Orders are created inside `verify` (a GET redirect
callback), only after Flutterwave confirms the transaction succeeded — by the time an `Order` row exists,
it's already `isPaid: true` with a completed `Payment`. There is no PENDING/unpaid Order sitting around
before payment.

#### `POST /api/payments/initialize`
- Auth: Bearer required. Checks `AppSetting.checkout_payments_enabled` first (`503` if disabled). Rate
  limited: 20 req / 15h per user+IP.
- Body (zod, `.strict()`):
```json
{
  "productId": "string (optional legacy single-item path)",
  "variantId": "string|null",
  "variantData": { "...": "string" } | null,
  "orderNote": "string ≤300 chars",
  "cartItems": [
    { "productId": "string", "variantId": "string|null", "variantData": {...}|null,
      "quantity": "int 1-50", "orderNote": "string ≤300", "buyerDeliveryAcknowledged": "boolean" }
  ]
}
```
  Prefer `cartItems` (up to 50 entries) — the server always re-fetches price/stock/seller/landmark from
  the DB per item; it never trusts a client-sent price (there isn't one to send).
- Validates per item: product exists & active & not deleted; if `variantId` given, must belong to the
  product (price/stock then come from the variant); seller not suspended;
  `product.moderationStatus` not `UNDER_REVIEW`/`REMOVED`; product's university (if set) matches the
  buyer's; stock ≥ quantity; buyer isn't buying their own product.
- Delivery fee: items grouped by `sellerId`; per seller group, `getDeliveryFee(buyerUniversityId,
  <that seller-group's first item's product.landmark>, buyer.landmark)` is computed and summed — see
  §5.1 for the exact zone-matching algorithm. `subtotal = Σ(price*quantity)` across all items,
  `totalAmount = subtotal + totalDeliveryFee`.
- Calls Flutterwave `POST /v3/payments` with `amount: totalAmount` (**whole Naira, not kobo**),
  `currency: 'NGN'`, `redirect_url: <APP_URL>/api/payments/verify`, `customer: {email, name}`,
  `tx_ref: "BATAMART-<timestamp>-<8 chars of userId>"`, `meta: { userId, cartItems: JSON.stringify(...),
  orderReference: reference }`.
- 200: `{ success: true, authorizationUrl, authorization_url (duplicate), transRef, reference (duplicate
  of transRef), deliveryFee, totalAmount }`
- Errors: `401`, `400` (invalid payload / self-purchase / unavailable product / campus mismatch /
  quantity / too many items), `404` (product not found), `429` (rate limited), `500`/`502`
  (misconfiguration or Flutterwave failure), `503` (payments disabled).
- **Mobile integration note:** open `authorizationUrl` in an in-app webview/browser for the hosted
  Flutterwave checkout (3DS/card entry happens on Flutterwave's page). Flutterwave then redirects to
  `redirect_url`, which is `GET /api/payments/verify` — see below for why that's not directly
  JSON-consumable by a native client.

#### `GET /api/payments/verify`
- This is a **browser redirect callback**, not a JSON API endpoint a mobile client calls directly with
  `Authorization`. It re-derives the buyer from `meta.userId` embedded in the (server-signed) Flutterwave
  transaction data, not from a bearer token.
- Query (from Flutterwave's redirect): `tx_ref` (or `transRef`/`reference`), `transaction_id`, `status`.
  Rate limited: 10 req / 10 min per IP+tx_ref.
- Flow: validates `tx_ref` format → if Flutterwave's own `status` param says not-successful, redirects
  immediately to `/checkout?error=payment_failed` → else calls Flutterwave's server-to-server verify
  endpoint → cross-checks `tx_ref` + `status successful/success` → **idempotency guard**: if a `Payment`
  already exists for this `transRef` with a linked order, redirects straight to success without
  recreating anything → parses `meta.cartItems` back out → re-validates paid amount against a freshly
  recomputed expected total (mismatch → `error=amount_mismatch`, no order created) → calls `createOrders`
  (see §5.5 for the batching + escrow bookkeeping this performs) → fires buyer/seller/rider notifications
  → redirects.
- Response: **always an HTTP redirect (302/307), never a JSON body.** Success:
  `<APP_URL>/orders?payment=success&order=<orderNumber>&count=<n>`. Failure variants (all redirects, no
  JSON): `?error=no_reference|invalid_reference|payment_failed|rate_limited|invalid_metadata|
  user_not_found|product_not_found|product_inactive|out_of_stock|amount_mismatch|order_creation_failed|
  verification_failed`.
- **Mobile integration note:** since this never returns JSON, a native client cannot call it as a normal
  API. Let the webview follow Flutterwave's redirect chain and detect the final `<APP_URL>/orders?...`
  URL (via URL-change interception or a custom deep-link scheme if the backend is updated to support
  one), then close the webview and poll `GET /api/orders/my-orders` (or `GET /api/orders/{id}` once you
  have an id) to confirm the new order landed, rather than trying to parse a JSON response from this
  route directly.

#### `GET /api/payment-availability`
- Auth: none.
- 200: `{ enabled: boolean }` — reads the `checkout_payments_enabled` `AppSetting` row; **defaults to
  `true`** if unset. Global (not per-university) kill switch. Call before showing the checkout button.

#### `POST /api/delivery/quote`
- Auth: Bearer required.
- Body: `{ cartItems: [{ productId: string }] }` (1–50 items, `.strict()`) — **no landmark/zone fields in
  the request**; the zones are derived server-side from `product.landmark` (pickup, per seller group's
  first item) and `user.landmark` (dropoff, the caller's own profile landmark).
- 200: `{ deliveryFee: number, sellerCount: number }`
- Errors: `401`, `400`, `500`.
- Use this to show a delivery-fee preview on the cart screen before the buyer commits to checkout — see
  §5.1 for the exact same-zone/route/fallback pricing rules this and `initialize` both call into.

---

### 3.6 Orders

⚠ Multiple order-listing/detail routes exist with overlapping purpose (`orders`, `my-orders`,
`seller-orders`, `sales`) — pick the one documented as canonical per use case below; two are flagged as
likely legacy/duplicate.

#### `GET /api/orders`
- Auth: Bearer required. Returns the caller's own orders as **buyer** (`buyerId: user.id`), no status
  filter (includes `CANCELLED`), includes `product, seller, rider, productReviews, reviews`.
- 200: `{ orders: [...] }` — each order has derived `deliveryAddress` (string concat of
  hostel/room/landmark) and a derived `isPaid: order.status === 'COMPLETED'`. ⚠ **This computed field
  shadows but is NOT the real `Order.isPaid` DB column** — it actually means "is this order fully
  completed," not "was it paid for." Don't trust this field name; if you need real payment status, use
  `order.payment?.status` or check `order.status` directly.

#### `POST /api/orders` — ⚠ legacy, do not use for real checkout
- Auth: Bearer required. Body: `{ productId, quantity }`. This is an alternate single-product
  direct-purchase path that **bypasses Flutterwave entirely** — no `Payment` row, `isPaid` stays `false`,
  no escrow `Transaction` bookkeeping, no `DeliveryBatch`. `platformCommission` here is computed as
  `product.price * 0.05` only (no delivery-fee cut — inconsistent with the real checkout formula, see
  §5.3). Given the real purchase flow is `payments/initialize` + `payments/verify`, this route appears
  disconnected from the live checkout UX. **Recommend the Flutter client never calls this for actual
  purchases.**

#### `GET /api/orders/my-orders` — recommended buyer order-history endpoint
- Auth: Bearer required. Returns buyer's orders **excluding `CANCELLED`**, each annotated server-side
  with dispute eligibility.
- 200: `{ success: true, orders: [{ id, orderNumber, totalAmount, product: {name, images, price},
  seller: {name, rating, trustLevel}, status, createdAt, deliveredAt, pickedUpAt, completedAt,
  canDispute, disputeReason, hasExistingDispute, existingDisputeStatus }], stats: { total,
  eligibleForDispute, alreadyDisputed, byStatus }, user: { id, name, email } }`
- `canDispute` uses the same 48-hour post-delivery window described in §5.7.

#### `GET /api/orders/seller-orders`
- Auth: Bearer required. Seller's incoming orders (`sellerId: user.id`), includes `buyer, product, rider,
  dispute`.
- 200: `{ success: true, orders, count }`

#### `GET /api/orders/sales`
- Auth: Bearer required. Same `sellerId: user.id` scope as `seller-orders` but includes `items`
  (`OrderItem` rows with variant data) instead of `dispute`/`rider`. Functionally near-duplicate of
  `seller-orders` with a different include shape — appears to be the newer of the two (has
  variant-aware line items). Prefer `sales` for a new client if you need per-item/variant detail on
  seller orders; use `seller-orders` if you need dispute/rider info instead. No route combines both.
- 200: `{ success: true, orders, count }`

#### `GET /api/orders/{id}`
- Auth: Bearer required. Caller must be the order's buyer, seller, rider, or `ADMIN` (`403` otherwise).
- 200: raw `Order` object (**not** wrapped in `{ order: ... }`) with `product.seller, buyer, seller,
  rider, reviews, productReviews, dispute` included.

#### `PATCH /api/orders/{id}` — manual status transition (admin/actor-scoped)
- Auth: Bearer required. Allowed transitions: `PENDING→[PROCESSING, RIDER_ASSIGNED]`,
  `PROCESSING→[RIDER_ASSIGNED]`, `RIDER_ASSIGNED→[PICKED_UP]`, `PICKED_UP→[ON_THE_WAY]`,
  `ON_THE_WAY→[DELIVERED]`, `DELIVERED→[COMPLETED]`, `COMPLETED→[]`, `CANCELLED→[]`. Non-admin actor
  restrictions: seller can only do `PENDING→PROCESSING` (this is the "Accept Order" action on the
  seller's Sales screen); rider can only do `RIDER_ASSIGNED→PICKED_UP`, `PICKED_UP→ON_THE_WAY`,
  `ON_THE_WAY→DELIVERED`; buyer can only do `DELIVERED→COMPLETED`.
- Body: `{ status: "PENDING"|"PROCESSING"|"RIDER_ASSIGNED"|"PICKED_UP"|"ON_THE_WAY"|"DELIVERED"|
  "COMPLETED"|"CANCELLED" }` (note: omits `SHIPPED`/`DISPUTED` from the full schema enum — those two
  aren't reachable through this route).
- ⚠ **Buyer `DELIVERED→COMPLETED` via this route does NOT run the escrow-release / referral-reward /
  MarketPrice side effects that `POST /api/orders/confirm-delivery` does.** Always use
  `confirm-delivery` (below) for the buyer's "Confirm Received" action — never PATCH status directly to
  `COMPLETED` from the client, or the rider won't get paid and the referral reward won't fire.
- 200: full updated `Order` (same shape as GET).
- Errors: `400` (invalid status/transition), `401`, `403`, `404`, `500`.

#### `POST /api/orders/confirm-delivery` — the real "Confirm Received" action
- Auth: Bearer required; caller must be `order.buyerId` (`403` otherwise). 5-second per-user-per-order
  cooldown against double-taps.
- Body: `{ orderId: string }`
- Precondition: `order.status` must be exactly `'DELIVERED'`. Already `COMPLETED` → `400 { error: 'Order
  already completed', alreadyCompleted: true }`; any other status → `400`.
- Effects: `status → COMPLETED`, `completedAt` set; releases the rider's delivery-fee cut (if a rider was
  assigned); processes any pending referral reward; records a `MarketPrice` snapshot; asynchronously
  re-evaluates "hot deal" status for similar listings. Full detail in §5.2/§5.5/§5.6.
- 200: `{ success: true, message: "🎉 Delivery confirmed. Seller funds stay in escrow for 48 hours; rider
  payment released.", order: {...} }`
- Errors: `401`, `400` (missing orderId / wrong status / already completed), `403` (not the buyer), `404`,
  `429` (cooldown), `500`.

#### `GET /api/orders/{id}/live-location`
- Auth: Bearer required; caller must be the order's buyer, seller, rider, or `ADMIN` (`403` otherwise).
- **Not a single "current location" field** — reads the most recent `AuditLog` entries
  (`entityType: 'ORDER_TRACKING'`) for this order: GPS pings (`action: 'RIDER_LOCATION_UPDATE'`, up to
  the last 80, chronological) plus non-GPS checkpoints (`RIDER_TRACKING_STARTED`,
  `RIDER_STATUS_CHECKPOINT`, up to the last 20). **Polling-based** — no WebSocket/SSE; poll this
  periodically while the order is in an active delivery state.
- 200: `{ success: true, orderId, orderStatus, rider: { id, name, phone, profilePhoto } | null,
  latestPoint: { id, at, lat, lng, accuracy, heading, speed } | null, points: [...up to 80...],
  checkpoints: [...up to 20...], updatedAt: <ISO of latestPoint> | null }`
- Errors: `401`, `403`, `404`, `500`.
- The corresponding write side (rider posting GPS pings) is `POST /api/riders/live-location` — §3.12.

---

### 3.7 Wallet

`GET /api/wallet` and `POST /api/wallet/withdraw` both opportunistically call
`releaseMaturedSellerEscrowForUser(user.id)` first if the caller is a `SELLER` — see §5.2/§5.3 for what
that sweeps.

#### `GET /api/wallet`
- Auth: Bearer required.
- 200: `{ wallet: { availableBalance: number, pendingBalance: number, completedOrders: number, role:
  string } }` — balances are `Math.max(0, Number(...))` of the Decimal fields (never negative).
  `completedOrders` counts `Order` rows in `[COMPLETED, DELIVERED]` scoped by role (`sellerId` for
  SELLER, `riderId` for RIDER, `buyerId` otherwise).
- Errors: `401`, `404`, `500`.

#### `GET /api/wallet/transactions`
- Auth: Bearer required.
- Query: `page` (default 1), `limit` (default 50) — no bounds validation, no `type` filter implemented
  (despite `Transaction.type` existing).
- 200: `{ transactions: [...raw Transaction rows...], pagination: { page, limit, total, pages } }`,
  ordered `createdAt desc`.

#### `POST /api/wallet/set-pin`
- Auth: Bearer required. Blocked if suspended (`403 { error, suspendedUntil }`).
- Body: `{ pin: string (exactly 6 digits), currentPin?: string, otpCode?: string }`
- Three branches: **(1) first-time set** (no existing PIN) — just `pin` needed, no currentPin/otp. **(2)
  change via `currentPin`** — bcrypt-compared against the stored hash; wrong → increments
  `withdrawalPinAttempts`, locks at 5 (`withdrawalPinLockedUntil = now+15min`). **(3) forgot-PIN via
  `otpCode`** — requires the account to have an email; validated via the same single-use `OTP` mechanism
  as auth OTP (`verifyOTP(email, otpCode)`). If neither `currentPin` nor `otpCode` is given while a PIN
  already exists → `400`.
- 200 (all branches): `{ success: true, message: "..." }` (message varies by branch).
- Errors: `401`, `403` (suspended), `400` (validation/missing fields), `401` (wrong currentPin, with
  attempts-remaining message), `429` (locked), `404`, `500`.

#### `POST /api/wallet/reset-pin`
- Auth: Bearer required (+ suspension gate). No body.
- Step 1 of the "forgot PIN" flow: emails a fresh OTP to the account's email. `400` if no email on file,
  or if no PIN is set yet at all (first-time users should call `set-pin` directly, not this route).
- 200: `{ success: true, message: "OTP sent to {email}", email }`
- Then call `POST /api/wallet/set-pin` with `{ pin, otpCode }` to complete the reset.
- Errors: `400` (no email / no existing pin), `500` (email send failure).

#### `POST /api/wallet/verify-pin`
- Auth: Bearer required (+ suspension gate).
- Body: `{ pin: string, 6 digits }`
- **UX-only standalone check** (e.g. gate showing the withdrawal form before it renders) — explicitly
  does not issue any token; `withdraw` independently re-verifies the PIN every time regardless of this
  call's result. Resets `withdrawalPinAttempts`/lock on success.
- 200: `{ success: true, message: 'PIN verified successfully' }`
- Errors: `400 { error: 'PIN_NOT_SET', message }` if no PIN set; `429` if locked; `401` wrong PIN
  (attempts-remaining / lock message).

#### `POST /api/wallet/withdraw`
- Auth: Bearer required (+ suspension gate). `enforceJsonRequest`/`enforceSameOrigin` also run (Bearer
  exempts the origin check).
- Body (zod, `.strict()`):
```json
{
  "amount": "int, 1000-500000",
  "bankCode": "string, 2-20 chars",
  "accountNumber": "string, 6-20 chars",
  "accountName": "string, 2-100 chars",
  "pin": "string, exactly 6 digits",
  "idempotencyKey": "string, 8-120 chars (optional)",
  "clientRequestId": "string, 8-120 chars (optional)"
}
```
  At least one of `idempotencyKey`/`clientRequestId` is required (`clientRequestId` wins if both given) —
  **generate and persist a unique value per withdrawal attempt** for safe retry.
- Constants: min ₦1,000, max ₦500,000, 30-second cooldown per user+IP, PIN lockout 5 attempts / 15 min
  (same shared counters as set-pin/verify-pin).
- **This is a real-time payout, not a pure admin queue.** After validating the PIN and atomically
  reserving the balance, it calls Flutterwave's Transfers API inline (`POST /transfers`). On success the
  `WithdrawalRequest` ends in `status: 'PROCESSING'` (awaiting Flutterwave's own completion, not shown in
  these routes) — not `COMPLETED`. On failure at any stage after the balance was deducted, the balance is
  refunded and the request is `REJECTED`.
- Idempotent replay: a retried call with the same `clientRequestId` returns the previously-stored result
  without re-attempting the transfer.
- 200: `{ success: true, message: 'Withdrawal initiated successfully', reference: "<withdrawalRequestId>",
  transferCode: "<flutterwave transfer id>|null", requestId: "<withdrawalRequestId>" }`
- Errors: `401`, `403` (suspended, or `{error:'PIN_REQUIRED'}` if no PIN set), `429` (cooldown or PIN
  lock), `400` (validation, or `{error:'Insufficient balance'}`), `401` (wrong PIN), `503 { error:
  'Payment network error. Your balance has been restored. Please try again.' }` (Flutterwave
  unreachable/errored), `500`.

**PIN lockout — exact numbers (shared across set-pin, verify-pin, withdraw):** 5 failed attempts →
`withdrawalPinLockedUntil = now + 15 minutes`. All three routes read/write the same
`withdrawalPinAttempts`/`withdrawalPinLockedUntil` User columns — a failed attempt on one route counts
toward lockout on the others. Any successful verification resets both to `0`/`null`.

---

### 3.8 Reviews

Person reviews (`Review`, seller **or** rider) and product reviews (`ProductReview`) are always **two
separate submissions** to two different endpoints — never combined server-side.

#### `POST /api/reviews` — review a SELLER or a RIDER
- Auth: Bearer required.
- Body: `{ orderId: string, type: "SELLER"|"RIDER", rating: 1-5, comment?: string }` — **a single
  endpoint handles both**; `type` picks the target (`order.sellerId` or `order.riderId` — `400` if the
  target field is null, e.g. no rider was ever assigned).
- Preconditions: order exists (`404`); caller is `order.buyerId` (`403`); `order.status` is `DELIVERED`
  or `COMPLETED` (`400`); no existing review for `{orderId, type, reviewerId}` already (`400`).
- 200: `{ success: true, review: { ...full Review row incl. reviewer: {id,name,profilePhoto}... },
  message: "SELLER review submitted successfully" }`
- Side effects: recomputes seller stats (if `type==='SELLER'`); fires an in-app notification to the
  reviewee.

#### `GET /api/reviews` — fetch reviews for a person
- Auth: none.
- Query: `userId` (required), `type` (required, `SELLER`|`RIDER`, case-insensitive) — **this is a
  query-param lookup, not a `/api/reviews/{userId}` path.**
- 200: `{ reviews: [...up to 20, newest first, incl. reviewer:{id,name,profilePhoto}, order:{product:
  {name}}...] }`
- Errors: `400` (missing params).

#### `POST /api/reviews/product` — review a PRODUCT
- Auth: Bearer required.
- Body: `{ orderId: string, productId?: string (defaults to order.productId), rating: 1-5, comment?:
  string }`
- Preconditions same pattern as person reviews (order exists, caller is buyer, order
  DELIVERED/COMPLETED, if `productId` given it must match the order's product, no duplicate review for
  `{orderId, productId, reviewerId}`).
- On success: creates the `ProductReview`, then recomputes the product's `avgRating`/`totalReviews` from
  all its reviews (simple mean), in one transaction.
- 200: `{ success: true, review: {...incl. reviewer...}, message: 'Product review submitted successfully'
  }`

#### `GET /api/reviews/product` — list + rating distribution for one product
- Auth: none.
- Query: `productId` (required, else `400`), `page` (default 1), `limit` (default 20).
- 200: `{ reviews: [...incl. reviewer, order:{id,createdAt}...], total, page, limit, totalPages,
  distribution: [{rating:1,count},...,{rating:5,count}] }` — `distribution` always has all 5 rating
  buckets, zero-filled if empty.

#### `GET /api/sellers/{sellerId}/reviews`
- Auth: none.
- 200: **a bare JSON array** (not wrapped in an object):
```json
[ { "id", "user": "Jane Doe", "avatar": "url|null", "rating": 5, "comment": "...", "createdAt": "...", "orderNumber": "BM-1234|null" } ]
```
  Hardcoded `take: 100`, no pagination params accepted, `SELLER`-type reviews only (rider reviews
  excluded). No average-rating field returned — compute it client-side from the array, or fetch it
  separately from a seller-profile source not covered in this doc.

---

### 3.9 Disputes & Reports

**48-hour dispute window** from `deliveredAt` (fallback `completedAt`) — hard-coded
(`DISPUTE_WINDOW_HOURS = 48` in `lib/escrow.ts`), not configurable per order. Full lifecycle detail in
§5.7.

#### `GET /api/disputes`
- Auth: Bearer required. All disputes where the caller is buyer or seller, incl. `order.product,
  buyer, seller, messages` (asc). No pagination.
- 200: `{ disputes: [...] }`

#### `POST /api/disputes` — open a dispute (buyer only)
- Auth: Bearer required.
- Body: `{ orderId, reason, description, evidence: string[] (≥1 required — upload via /api/upload first
  and pass the resulting URLs), resolutionPreference?: string (default 'REFUND_WITH_PICKUP'),
  pickupAddress?: object }`
- Eligibility: caller must be `order.buyerId` (`403` otherwise — sellers cannot open disputes through
  this route); order must not already have a dispute (`400`); `order.status` must be `DELIVERED` or
  `COMPLETED` (`400`); within the 48-hour window of `deliveredAt`/`completedAt` (`400` with an explicit
  expiry message otherwise).
- On success: creates the `Dispute` (`status: OPEN`), flips `Order.isDisputed: true, status: 'DISPUTED'`,
  and creates an initial `DisputeMessage` from the buyer containing the reason/description/evidence, all
  in one transaction. Notifies the seller.
- 200: `{ success: true, dispute: {...incl. order.product, buyer, seller...}, message: 'Dispute opened
  successfully' }`

#### `GET /api/disputes/{id}`
- Auth: Bearer required. Caller must be `buyerId`, `sellerId`, or `ADMIN` (`403` otherwise).
- 200: `{ success: true, dispute: {...incl. order.product, buyer{...+email,phone}, seller{...+email,
  phone}, messages...} }`

#### `GET /api/disputes/{id}/messages`
- Auth: Bearer required. **Only buyer or `ADMIN`** — the seller has no access to this thread through
  these routes at all (`403` for sellers, unlike `GET /api/disputes/{id}` which does allow sellers to see
  the dispute record itself).
- 200: `{ success: true, messages: [...senderType IN ('BUYER','ADMIN') only...], count }`

#### `POST /api/disputes/{id}/messages`
- Auth: Bearer required. **Only buyer or `ADMIN`** can post (same restriction as GET).
- Body: `{ message: string (required, trimmed non-empty), attachments?: string[] (URLs, default []) }`
- `senderType` is auto-set to `'ADMIN'` or `'BUYER'` based on caller. If an admin sends the first reply
  while `status === 'OPEN'`, the dispute auto-advances to `UNDER_REVIEW`. Attachments are plain URL
  strings — upload the file elsewhere (`/api/upload`) first, then pass the URL(s) here.
- 200: `{ success: true, message: {...new DisputeMessage row...} }`

#### `POST /api/disputes/{id}/confirm-return` — seller confirms a return item's receipt
- Auth: Bearer required. **Only the seller** (`dispute.sellerId === user.id`, `403 'Only seller can
  confirm return receipt'` otherwise) — despite the generic name, this is a seller-side action, not a
  buyer one.
- No body.
- Preconditions: dispute status must be `UNDER_REVIEW` (`400` otherwise); `dispute.resolution` must
  currently be the internal sentinel `'__RETURN_DELIVERED_TO_SELLER__'` (`400 'Return has not been
  delivered by rider yet'` otherwise) — set by the rider's own status-update flow (§3.12) once they mark
  the return item delivered back to the seller.
- Money movement (all one transaction): computes `sellerEscrowHeld = max(0, (totalAmount - deliveryFee if
  rider present) - platformCommission)`, deducts a Flutterwave gateway fee + a 3% service fee, nets the
  remainder as `netRefund`, moves it from seller `pendingBalance` to buyer `availableBalance`, creates
  matching `CREDIT`/`DEBIT` `Transaction` rows, sets `Dispute.status → 'RESOLVED_BUYER_FAVOR'`,
  `Order.status → 'COMPLETED'`.
- 200: `{ success: true, message: "Return confirmed. Buyer refund released.", summary: { grossRefund,
  gatewayFee, serviceFee, netRefund } }`

#### `POST /api/reports`
- Auth: Bearer required.
- Body: `{ type: "PRODUCT"|"SELLER"|"RIDER"|"BUYER", reason: string (one of `FAKE_PRODUCT`,
  `WRONG_DESCRIPTION`, `POOR_QUALITY`, `DELAYED_DELIVERY`, `RUDE_BEHAVIOR`, `SCAM`,
  `INAPPROPRIATE_CONTENT`, `PAYMENT_ISSUE`, `OTHER` — not validated against this list in the route
  itself, an invalid value throws at the Prisma layer as a `500`), description: string, evidence?:
  string[], reportedUserId?, reportedProductId?, reportedOrderId? }`
- **Purely informational for admin review** — does not auto-create a `Dispute` or `Penalty`.
- 200: `{ success: true, reportId, message: 'Report submitted successfully' }`

#### `GET /api/reports`
- Auth: Bearer required. Caller's own submitted reports (`reporterId: user.id`), incl.
  `reportedUser{name,phone}, reportedProduct{name}`. No pagination.
- 200: `{ reports: [...] }`

---

### 3.10 Notifications

#### `GET /api/notifications`
- Auth: Bearer required.
- Query: `unreadOnly?` ("true"), `limit?` (default 50).
- 200: `{ notifications: [...raw Notification rows...], unreadCount: number }` (unreadCount is
  independent of `limit`/`unreadOnly`, always the true total). Server caches responses in-memory for 20s
  per `userId:unreadOnly:limit` — a poll faster than 20s may return stale data.

#### `PATCH /api/notifications` — mark as read
- Auth: Bearer required.
- Body: `{ markAllAsRead?: boolean, notificationIds?: string[] }` — `markAllAsRead` takes priority if
  present; otherwise `notificationIds` marks only those (scoped to the caller for safety).
- 200: `{ success: true, message: "..." }`
- Errors: `400` if neither param given validly.

#### `DELETE /api/notifications`
- Auth: Bearer required.
- Query: `id?` (single notification) or `deleteAll=true`.
- 200: `{ success: true, message: "..." }`
- Errors: `400` if neither given.

**Notification types** (27 values): `ORDER_PLACED, ORDER_PROCESSING, RIDER_ASSIGNED, ORDER_PICKED_UP,
ORDER_ON_THE_WAY, ORDER_DELIVERED, ORDER_COMPLETED, ORDER_DISPUTED, ORDER_CANCELLED, PRODUCT_REVIEWED,
SELLER_REVIEWED, RIDER_REVIEWED, DISPUTE_OPENED, DISPUTE_MESSAGE, DISPUTE_RESOLVED, REPORT_SUBMITTED,
REPORT_RESOLVED, PENALTY_ISSUED, ACCOUNT_SUSPENDED, ACCOUNT_UNSUSPENDED, WITHDRAWAL_PROCESSED,
PAYMENT_RECEIVED, REFERRAL_REWARD, STOCK_ALERT, OVERSIZED_DECLINED, OVERSIZED_REFUND_ISSUED,
PRODUCT_UNDER_REVIEW, SELLER_STRIKE_ISSUED, CAMPAIGN_ANNOUNCEMENT`. Use `type` + `metadata` to route deep
links client-side (order id, dispute id, product id, etc. are on the notification row directly).

#### `POST /api/push/subscribe` / `DELETE /api/push/subscribe`
- Auth: Bearer required.
- **This is Web Push (VAPID subscription: `{endpoint, keys:{p256dh,auth}}`), not FCM/APNs.** A native
  Flutter app should integrate its own push channel (Firebase Cloud Messaging is the natural choice) —
  this endpoint's request shape is browser-specific and not directly usable from a mobile SDK without a
  compatibility shim. Flag to the backend team if native push tokens need a new endpoint; don't try to
  force FCM tokens through this route's `{endpoint, keys}` shape.
- POST body: `{ endpoint: string, keys: { p256dh: string, auth: string } }` → `200 { success: true }`
  (upserts by `endpoint`).
- DELETE body: `{ endpoint: string }` → `200 { success: true }` (no-op if not found).

---

### 3.11 Referrals

#### `GET /api/referrals`
- Auth: Bearer required.
- 200:
```json
{
  "referralCode": "string",
  "referralLink": "https://.../signup?ref=CODE",
  "totalReferrals": 4,
  "totalEarnings": 480,
  "totalReferralOrders": 9,
  "referrals": [ { "id", "name", "joinedAt", "completedOrders" } ],
  "recentRewards": [ { "id", "amount", "orderNumber", "orderAmount", "earnedAt" } ]
}
```
  `referrals` = every user with `referredById = caller.id`, each with their own completed-order count.
  `recentRewards` = up to 20 most recent `ReferralReward` rows earned by the caller. `totalEarnings` sums
  **all** reward amounts (not just the 20 shown).
- **This route is read-only** — it never creates `ReferralReward` rows itself. Crediting happens as a
  side effect of order/delivery completion — see §5.6.

---

### 3.12 Riders

Every route below (except `login`/`register`) does its own explicit gate:
`if (!user || user.role !== 'RIDER') return 401`. This — not the web `middleware.ts` page routing — is
what actually protects rider-only functionality from a mobile client hitting the API directly.

#### `POST /api/riders/login`
- Auth: none. ⚠ Same-origin gotcha, §1.3.
- Body: `{ email: string, password: string }` — riders log in by **email**, a separate flow from the
  general phone/email `login-with-password`.
- 200: `{ success: true, token: "<jwt, 90-day expiry>", user: { id, name, email, phone, role: "RIDER",
  isRiderVerified, isAvailable, availableBalance, pendingBalance } }`
- Errors: `400` missing fields; `401 { error: 'Invalid email or password' }` (deliberately identical
  message for not-found vs. wrong-password); `403 { error: 'This account is not a rider account' }`;
  `403 { error: 'Rider account pending verification' }` (`isRiderVerified: false`); `403 { error: 'Your
  account has been suspended' }`; `500`.

#### `POST /api/riders/register`
- Auth: none. ⚠ Same-origin gotcha, §1.3.
- Body: `{ name, phone, email, password (≥8 chars, must contain a digit), idDocument: string (base64
  image, required), universityId: string (required) }`
- **Creates the `User` row immediately** with `role: 'RIDER'`, but `isRiderVerified: false,
  isAvailable: false` — the account exists but cannot log in via `riders/login` (blocked by the
  verification check) until verified by an out-of-scope admin process. `idDocument` uploads to Cloudinary
  (`BATAMART-rider-ids` folder) via a signed upload distinct from the shared `/api/upload` route; falls
  back to storing the raw base64 string if Cloudinary isn't configured or the upload fails.
- 200: `{ success: true, message: "Rider registration successful! You can now log in.", rider: { id,
  name, email, phone, universityId } }`
- Errors: `400` per-field validation (missing fields, weak password, missing idDocument/universityId,
  invalid universityId, duplicate email/phone), `500`.

#### `POST /api/riders/toggle-availability`
- Auth: Bearer required, RIDER role. No body — flips the current `isAvailable` value.
- 200: `{ success: true, isAvailable: boolean }`

#### `POST /api/riders/live-location`
- Auth: Bearer required, RIDER role.
- Body: `{ orderIds?: string[], batchId?: string, lat: number, lng: number, accuracy?: number, heading?:
  number, speed?: number }` — one of `orderIds`/`batchId` required (`orderIds` wins if both given).
  `lat`/`lng` validated as finite, in-range.
- Matches up to 30 of the rider's own orders currently in a "trackable" status
  (`RIDER_ASSIGNED|PICKED_UP|ON_THE_WAY`) against the given ids/batch, and writes one `AuditLog` row per
  matched order (`action: 'RIDER_LOCATION_UPDATE'`) — **not** a dedicated live-location column; this is
  what `GET /api/orders/{id}/live-location` (§3.6) reads back. No fixed expected ping interval in code —
  client's discretion (a reasonable choice is every 15–30s while an active delivery is in progress).
- 200: `{ success: true, written: number }` (0 if no matching trackable orders — not an error).
- Errors: `401`, `400` (invalid coords / missing orderIds+batchId), `500`.

#### `POST /api/riders/update-status`
- Auth: Bearer required, RIDER role.
- Body: `{ orderId: string, status: "PICKED_UP"|"ON_THE_WAY"|"DELIVERED" }` — **by individual `orderId`,
  not `batchId`** (the rider calls this once per order/leg in their batch).
- Enforced transitions only: `RIDER_ASSIGNED→PICKED_UP`, `PICKED_UP→ON_THE_WAY`, `ON_THE_WAY→DELIVERED`.
  Ownership check: `order.riderId !== user.id → 403`.
- Effects: sets the corresponding timestamp; writes an audit checkpoint; if it's a dispute-return order
  (`isDisputed && dispute`), advances the dispute's internal sentinel (`ON_THE_WAY` →
  `'__RETURN_ON_THE_WAY__'`, `DELIVERED` → `'__RETURN_DELIVERED_TO_SELLER__'` — this is the trigger the
  seller's `confirm-return` route, §3.9, waits on); on `DELIVERED` increments the rider's
  `completedOrders`; **batch cascade** — if the order belongs to a `DeliveryBatch`, sets the batch to
  `IN_PROGRESS` on `PICKED_UP`/`ON_THE_WAY`, or to `COMPLETED` once every order in the batch is
  `DELIVERED` (otherwise stays `IN_PROGRESS`). Fires buyer notifications (and a seller notification for
  the dispute-return-delivered case).
- 200: `{ success: true, order: {...full updated Order...} }` — note the **batch's own status is not
  returned here**; re-fetch `my-deliveries`/`available-orders` if you need it.
- Errors: `401`, `404`, `403` (not your delivery), `400` (invalid status / invalid transition), `500`.

#### `GET /api/riders/available-orders`
- Auth: Bearer required, RIDER role. Scoped to the rider's own `universityId` (empty result if the rider
  has none).
- 200: `{ batches: [...DeliveryBatch, status:'PENDING', riderId:null, university-scoped, incl. buyer +
  nested orders (each with product + seller)...], disputePickups: [...this rider's own dispute-return
  pickup jobs...] }`
- Note: a batch can appear here while some of its individual orders are still `PENDING` (not yet accepted
  by their seller) — claimability is enforced separately at `accept-order` time (see
  `AWAITING_SELLER_ACCEPTANCE` below), so treat orders inside a listed batch that are still `PENDING` as
  "waiting on the seller."
- `disputePickups`: orders already assigned to this rider that are dispute-return jobs
  (`isDisputed: true`, various sentinel `dispute.resolution` states), incl. `product, seller, buyer,
  dispute`.

#### `POST /api/riders/accept-order` — claim a whole batch
- Auth: Bearer required, RIDER role.
- Body: `{ batchId: string }` — **claims by `batchId`, not `orderId`.**
- Pre-checks (returned as `400`/`409` with a machine-readable `blockReason` for UI branching):
  - `blockReason: 'DISPUTE_PICKUP_PENDING'` — rider has an unfinished dispute pickup to resolve first.
  - `blockReason: 'ACTIVE_DELIVERY'` — rider already has an active batch (`RIDER_ASSIGNED`/`IN_PROGRESS`)
    — one active batch at a time.
  - `404` batch not found; `409` batch already claimed by someone else (race) or not `PENDING`; `403`
    university mismatch; `409 { blockReason: 'AWAITING_SELLER_ACCEPTANCE' }` if any order in the batch is
    still `PENDING`; `409 { blockReason: 'CAMPAIGN_DELIVERY_NOT_STARTED' }` if a campaign-tagged item's
    delivery window hasn't opened yet (message includes the campaign label + release date).
- On success (one transaction, race-safe): sets `DeliveryBatch.riderId = user.id, status =
  'RIDER_ASSIGNED'`; cascades the same `riderId`/`status: 'RIDER_ASSIGNED'`/`riderAssignedAt` onto every
  `PROCESSING` order in the batch; escrows the rider's total delivery-fee share (70% of each order's
  `deliveryFee`, summed) into the rider's `pendingBalance` with a matching `ESCROW` `Transaction`; fires
  buyer+seller notifications per order.
- 200: `{ success: true, message: "Batch accepted! N order(s) to pick up.", riderFee: number,
  batchNumber, orderCount, batch: {...refetched, incl. buyer + orders...} }`

#### `POST /api/riders/decline-oversized`
- Auth: Bearer required, RIDER role.
- Body: `{ orderId: string, reason: string (must exactly equal "Item Too Large For Motorcycle
  Delivery"), proofImageUrl?: string }`
- Effects (one transaction, via `applyOversizedDecline`): cancels the order (`status: 'CANCELLED'`,
  `oversizedCancellationReason`); refunds the buyer the **product amount only** —
  `refundAmount = totalAmount - deliveryFee` — credited to `availableBalance` (the delivery fee is kept,
  not refunded); issues/increments a `SellerStrike` (2nd strike = 3-day suspension, 3rd = 14-day, 4th+ =
  permanent — same tiers as §5.9); deactivates the product on the first strike, and always resets its
  `moderationStatus` to `PENDING`; upserts an `OversizedDeclineLog` (unique per `[orderId, riderId]`, so a
  rider can't double-refund the same order); notifies buyer/seller/rider/admins. **The rider does not
  lose their already-escrowed delivery-fee cut** — nothing here decrements the rider's `pendingBalance`.
- 200: `{ success: true, message: 'Order cancelled and buyer refunded (delivery fee retained).',
  strikeCount, order }`
- Errors: `400` (missing orderId / wrong reason string), `404` (order not found / not this rider's
  order), `409` (already cancelled / duplicate decline), `500`.

#### `POST /api/riders/dispute-picked-up`
- Auth: Bearer required, RIDER role.
- Body: `{ orderId: string }`
- Despite the name, this marks the **return-item pickup leg complete** (collecting a disputed item from
  the buyer to bring back to the seller), not "disputing a pickup." Requires the order to be this
  rider's, `isDisputed: true`, `status: 'RIDER_ASSIGNED'`, and `dispute.resolution` in
  `['__AWAITING_PICKUP__', '__SELLER_FAULT_AWAITING_PICKUP__']`.
- Effects: `Order.status → 'PICKED_UP'`; `Dispute.status → 'UNDER_REVIEW'`,
  `resolution → '__RETURN_PICKED_UP__'`; notifies the buyer.
- 200: `{ success: true, message: "Marked as collected. Return the item to complete and earn your ₦X.",
  order }` (the ₦X — 70% of the order's delivery fee — is only in the message string, not a separate
  JSON field).
- Errors: `400` (missing orderId), `404` ("Pickup job not found or already completed"), `500`.

#### `GET /api/riders/my-deliveries`
- Auth: Bearer required, RIDER role.
- 200: `{ batches: [...only status IN ['RIDER_ASSIGNED','IN_PROGRESS'] for this rider, incl. buyer +
  nested orders (asc by createdAt), each order incl. product + seller...] }`
- **Only active/in-progress deliveries** — no historical/completed batches, and no separate history route
  exists among the documented endpoints. If delivery history is needed, that's a gap to raise with the
  backend team.

---

### 3.13 Uploads

#### `POST /api/upload`
- Auth: Bearer required (any role). Rate limited: 20 uploads / 15 min per user+IP → `429` with
  `Retry-After`.
- Body: `{ image: string }` — a **base64 data URI** (`data:image/jpeg;base64,...`), **not**
  multipart/form-data. Accepted MIME: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`. Max size
  **5MB** (checked via base64 length before decode, then magic-byte-verified against the declared MIME
  type to prevent spoofing).
- Runs automated content moderation (`422` if flagged inappropriate).
- Storage: **Cloudinary**, folder `BATAMART-products/{userId}`. Returned URL is validated to actually be
  a `https://res.cloudinary.com/...` URL before being sent back.
- 200: `{ success: true, url: "https://res.cloudinary.com/...", publicId: string }` — this is a generic
  image endpoint; nothing here writes to `Product.images`/dispute attachments/etc. automatically. Store
  the returned `url` wherever you need it (product creation's `images` array, dispute `evidence`/
  `attachments`).
- Errors: `401`, `429`, `400` (missing image / bad data-URI / disallowed MIME / too large / magic-byte
  mismatch), `422` (moderation rejected), `500` (Cloudinary not configured / upload failed).

---

### 3.14 Misc

#### `POST /api/support/contact`
- Auth: **none required** (public), but attaches `userId` if a valid Bearer token happens to be present.
- Body: `{ name: string, email: string, category?: string (defaults 'OTHER'; one of PAYMENT_ISSUE,
  ORDER_PROBLEM, ACCOUNT_ISSUE, DISPUTE_HELP, SELLER_ISSUE, RIDER_ISSUE, BUG_REPORT, OTHER — unrecognized
  values are still stored, just labeled "Other" in the notification email), message: string (≥10 chars
  trimmed) }`
- Creates a `SupportTicket` and **synchronously** sends both an admin-notification email and an
  auto-reply email to the submitter — the request only succeeds (`200`) if both emails send, so a
  transient email-provider outage will surface as a `500` even though the ticket may have been written to
  the DB.
- 200: `{ success: true, ticketRef: "TICKET-XXXXXXXX", message: "..." }`
- Errors: `400` (missing fields / message too short), `500` (DB or email failure, indistinguishable).

#### `POST /api/session-event` — anonymous/authenticated analytics
- Auth: optional (works anonymously via a client-generated `sessionId`).
- Body: `{ sessionId: string (required), eventType: "view"|"click"|"search" (required, only these three
  values accepted), productId?: string, meta?: object }`
- Feeds the co-view recommendation signal (`ProductCoView`, used by `products/{id}/related` and
  `products/feed`) and the `people-like-you` feed's session-based scoring.
- 200: `{ success: true }`
- Errors: `400` (missing sessionId/eventType, or invalid eventType), `500`.
- Recommend firing this on product-detail views (`eventType: 'view', productId`), search submissions
  (`eventType: 'search', meta: { query }`), and notable taps (`eventType: 'click'`) to keep the
  recommendation features working as well as they do on web.

#### `GET|POST /api/sellers/update-stats` — ⚠ not part of the mobile API surface
- Auth: **none at all** — no user/role check in either method. `POST` recomputes stats for an arbitrary
  `{ sellerId }` in the body; `GET` recomputes for **every** seller in one pass (rating, review count,
  completed orders, trust-level tier). This looks like an internal/cron-triggered batch job, not a
  customer-facing endpoint. **Do not call this from the Flutter app** — seller rating/trust data should
  come from the read endpoints that already expose it (`GET /api/auth/me`, `GET
  /api/products` seller sub-object, `GET /api/sellers/{sellerId}/reviews`), not by triggering a recompute.
  Worth flagging to the backend team separately that it has no auth at all.

---

## 4. Business Rules & Gotchas

### 4.1 Zone-based delivery pricing, end to end

Delivery fees are never entered/looked-up by zone **ID** from the client — the whole system is driven by
matching free-text `landmark` strings (`Product.landmark` = pickup, `User.landmark` = drop-off) against
`DeliveryZone.name`, case-insensitively. The algorithm (`getDeliveryFee`, `lib/delivery/pricing.ts`),
used by both `POST /api/delivery/quote` and `POST /api/payments/initialize`:

```
normalise(x) = x.trim().toLowerCase()

if missing universityId/pickup/dropoff → FALLBACK_DELIVERY_FEE (₦2000)
if normalise(pickup) === normalise(dropoff) → SAME_ZONE_FEE (₦1000), flat, no DB lookup
else:
  zoneA = DeliveryZone matching normalised pickup name (active, this university)
  zoneB = DeliveryZone matching normalised dropoff name (active, this university)
  if either not found → FALLBACK_DELIVERY_FEE (₦2000)
  route = DeliveryRoute where (zoneAId,zoneBId) matches (zoneA,zoneB) in EITHER order, active
  if no route → FALLBACK_DELIVERY_FEE (₦2000)
  else → route.price
```

Never throws — always returns a number, logging a `console.warn` server-side on any fallback. For a
multi-seller cart, the fee is computed **per seller** (using that seller's first cart item's product
landmark as the pickup point) and summed — so a 3-seller cart pays up to 3 separate zone fees, one per
seller leg, not one fee for the whole order.

### 4.2 Escrow flow — exact money trace

| Stage | Trigger | What moves | Transaction |
|---|---|---|---|
| Order created | Flutterwave payment verified (`GET /api/payments/verify`) | `(subtotal − 5%)` → seller `pendingBalance` | `ESCROW`, ref `<order>-SELLER-ESCROW` |
| Order created | same | audit-only buyer record (no real balance) | `DEBIT`, ref `<order>-BUYER-PAYMENT` |
| Rider claims batch | `POST /api/riders/accept-order` | 70% of each order's `deliveryFee` → rider `pendingBalance` | `ESCROW` |
| Buyer confirms | `POST /api/orders/confirm-delivery` (`DELIVERED→COMPLETED`) | rider's already-escrowed 70% delivery-fee cut → rider `availableBalance` | `CREDIT`, ref `<order>-RIDER-RELEASE` |
| Buyer confirms | same | referral reward (if applicable) → referrer `availableBalance` | `REFERRAL_REWARD` |
| 48h after `deliveredAt` | **Lazy** — next time the seller hits `GET /api/wallet` or `POST /api/wallet/withdraw` | seller `pendingBalance` → `availableBalance` | `CREDIT`, ref `<order>-SELLER-RELEASE-48H` |

Key point: **the seller's cut is never released by a timer/cron in these routes — it's swept lazily** the
next time the seller's wallet is touched, once 48 hours have passed since delivery with no open dispute.
A seller who never opens the app again after 48 hours simply has an unswept `pendingBalance` sitting
there until they do. The 48-hour figure is the *same* constant as the dispute window
(`DISPUTE_WINDOW_HOURS = 48` in `lib/escrow.ts`) — escrow matures exactly when the window to dispute
closes.

If a dispute resolves in the buyer's favor via `POST /api/disputes/{id}/confirm-return`, a different
path fires instead: seller's `pendingBalance` is debited `netRefund` (gross minus a Flutterwave gateway
fee and a 3% service fee) straight to the buyer's `availableBalance`, bypassing the 48h wait entirely.

### 4.3 Platform commission

**Confirmed 5% rate**, but the full formula is not simply "5% of the order" — it also includes a cut of
the delivery fee:

```
Order.platformCommission = (orderSubtotal × 0.05) + (deliveryFee × 0.30)
```

computed per seller-leg inside `createOrders()` at payment-verify time, stored once, never recomputed.
The 30%-of-delivery-fee piece is the platform's share of the rider fee (the rider keeps the other 70% —
see §4.4/§4.2). ⚠ The legacy `POST /api/orders` route computes commission differently (`price × 0.05`
only, no delivery-fee cut, and using unit price rather than `price × quantity`) — that route is
disconnected from the real checkout flow (§3.6), so don't treat its formula as canonical.

### 4.4 Rider delivery batches

One buyer's checkout across N different sellers' products produces **1 `DeliveryBatch` + N `Order`
rows** (one order per seller "leg"), all sharing the batch id and the checkout's payment reference. A
rider claims the **whole batch at once** (`POST /api/riders/accept-order` with `batchId`), which cascades
`riderId`/`RIDER_ASSIGNED` onto every order in it — a rider can't cherry-pick individual legs of a batch.
From there, status advancement is **per order** (`POST /api/riders/update-status` with `orderId`), and
the batch's own status auto-derives: `IN_PROGRESS` as soon as any leg moves past `RIDER_ASSIGNED`,
`COMPLETED` once every leg reaches `DELIVERED`. A rider can only have **one active batch at a time**
(`accept-order` blocks with `blockReason: 'ACTIVE_DELIVERY'` otherwise) and must resolve any pending
dispute-return pickup before claiming a new batch (`blockReason: 'DISPUTE_PICKUP_PENDING'`).

### 4.5 Withdrawal PIN + lockout

6-digit numeric PIN (bcrypt-hashed server-side, `User.withdrawalPin`). First-time set needs nothing but
the new PIN; changing it needs either the current PIN or an emailed OTP (`reset-pin` → `set-pin` with
`otpCode`). `verify-pin` is a UX-only pre-check with no security effect on `withdraw` (which always
independently re-verifies). **Lockout: 5 wrong attempts → 15-minute lock**, tracked on shared
`withdrawalPinAttempts`/`withdrawalPinLockedUntil` columns used identically by `set-pin`, `verify-pin`,
and `withdraw` — a wrong attempt on any one of the three counts against the same lockout. Successful
verification anywhere resets the counter. `withdraw` itself is a **live Flutterwave transfer call**, not
a pure admin queue — it ends in `PROCESSING` (awaiting the gateway) or `REJECTED` (auto-refunded) by the
time the HTTP response returns, never `COMPLETED` synchronously. No routes in this doc reference
biometric withdrawal server-side — biometric auth (if implemented) would be a purely client-side gate in
front of calling `verify-pin`/`withdraw` with a PIN the app has cached/re-entered, not a separate backend
mechanism.

### 4.6 Referral reward flow

`GET /api/referrals` only *reads* referral data — it never creates a `ReferralReward`. Crediting happens
inside the delivery-confirmation transaction (`POST /api/orders/confirm-delivery`, alongside the escrow
release described in §4.2), via `processReferralReward`, and is **batch-aware**: paid once per
`DeliveryBatch` (gated by `DeliveryBatch.referralPaid`, so a multi-seller order doesn't pay the referral
bonus multiple times), scaled roughly as a flat amount (₦120, `REFERRAL_DELIVERY_REWARD`) times the
number of orders/legs in that batch, credited straight to the referrer's `availableBalance` (no escrow
step for referral payouts — they're immediate, unlike the seller's cut).

### 4.7 Dispute flow

Buyer-initiated only (`POST /api/disputes` explicitly requires the caller to be `order.buyerId` — sellers
cannot open one). Eligibility: order `DELIVERED`/`COMPLETED`, no existing dispute on that order, and
**within 48 hours of `deliveredAt`** (falls back to `completedAt`). Opening one immediately flips
`Order.status → 'DISPUTED'` and `isDisputed: true`, and posts the buyer's reason/description/evidence as
the first `DisputeMessage`. Ongoing messaging (`GET`/`POST .../messages`) is restricted to **buyer and
admin only** — the seller can see the dispute record itself (`GET /api/disputes/{id}`) but has no access
to the message thread through any route documented here. Terminal states:
`RESOLVED_BUYER_FAVOR`/`RESOLVED_SELLER_FAVOR`/`RESOLVED_COMPROMISE`/`DISMISSED` — but note the return
flow uses `Dispute.resolution` as a **state-machine sentinel string** along the way
(`__AWAITING_PICKUP__` → `__RETURN_PICKED_UP__` → `__RETURN_ON_THE_WAY__` →
`__RETURN_DELIVERED_TO_SELLER__`, advanced by the rider's `update-status`/`dispute-picked-up` calls),
before the seller's `confirm-return` call finally sets the real terminal
`status: 'RESOLVED_BUYER_FAVOR'` and releases a fee-adjusted refund from the seller's escrowed balance
straight to the buyer.

### 4.8 Suspension / penalty system

`User.isSuspended`/`suspendedUntil`/`suspensionReason` gate login (`login-with-password`, `google`) and
`auth/me`, all returning a `403` with `{ suspended, reason, until }` when blocked. Suspension auto-lifts
lazily the next time any of `checkSuspension`-aware code runs (login, `/me`, `/suspension-info`, wallet
routes) and finds `suspendedUntil` in the past — there's no background sweep, only lazy checks on access.
`Penalty`/`SellerStrike` creation is largely out of this doc's route scope (admin-side), with one
confirmed exception: the oversized-item decline flow (`POST /api/riders/decline-oversized`)
auto-generates `SellerStrike` records and computes suspension length by strike count (2nd = 3 days, 3rd =
14 days, 4th+ = permanent) — this is the one concrete, fully-traced trigger for automatic suspension in
the routes read for this doc. `warningCount`/`penaltyPoints` exist on `User` but are barely surfaced to
clients — only `penaltyPoints` appears (in `/api/auth/me`'s success body); `warningCount` isn't returned
by any route documented here.

### 4.9 Campaign tagging

`Product.campaignTag` is a free string (validated against a known-key list server-side, e.g.
`"GIRLFRIENDS_DAY"`), set at product-create/edit time (`POST`/`PUT /api/products`), paired with an
auto-computed `campaignExpiresAt` (badge auto-hides after that date). At purchase time, the tag is
**snapshotted onto `Order.campaignTag`** — permanent for that order, never re-derived from the live
Product afterward (so an order keeps showing its original campaign badge even if the product's tag is
later changed or expires). Campaign tags also gate rider batch-claiming: `POST /api/riders/accept-order`
rejects a batch with `blockReason: 'CAMPAIGN_DELIVERY_NOT_STARTED'` if any item's campaign has a delivery
window that hasn't opened yet.

### 4.10 Known inconsistencies to design around, not silently "fix" client-side

- `GET /api/orders`'s derived `isPaid` field is `order.status === 'COMPLETED'`, **not** the real
  `Order.isPaid` column — misleading name, don't trust it for actual payment-status checks.
- `POST /api/orders` (legacy single-item path) and the real checkout path
  (`payments/initialize`+`verify`) compute `platformCommission` with different formulas — only the
  checkout path's formula (§4.3) should be treated as canonical; avoid the legacy route entirely.
- `PATCH /api/orders/{id}` can move an order `DELIVERED→COMPLETED` (as the buyer) without running any of
  the escrow-release/referral/MarketPrice side effects that `POST /api/orders/confirm-delivery` runs —
  always use `confirm-delivery` for the buyer's "Confirm Received" action, never the generic PATCH.
- `seller-orders` vs `sales` are near-duplicate seller order-listing endpoints with different `include`
  shapes (dispute/rider vs. line-item/variant detail) — pick one per screen based on which fields you
  need; there's no single endpoint with both.
- `sellers/update-stats` (GET and POST) has no authentication at all and is very likely an
  internal/cron/admin tool, not part of the intended mobile surface — don't call it from the app.
- `PendingCharge`'s schema comment describes a Flutterwave v4 flow, but the routes actually documented
  here use Flutterwave v3 hosted checkout and never touch that table — don't design around
  `PendingCharge`.
