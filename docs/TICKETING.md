# BataMart online ticketing: spec and contract

Everything that builds ticketing (web, API, Flutter app) follows this file. If you must deviate, say so in your final report.

## 1. Product rules (decided with the owner)

- **Hosts** list an event (name, venue, date/time, flyer image) with one or more **tiers** (Regular, VIP, ...). Each tier: price (whole naira, min 100), capacity, optional sale window, optional tier image, and two commission percents (`randomCommissionPct` for any seller, `uniqueCommissionPct` for the host's named sellers). Max commission 30%.
- A host must be a **seller** (role SELLER, same gate as listing a product) and must **have a username**. Every event starts `PENDING_REVIEW`; an **admin approves** it before it is public. Admin can also reject (with note), pause, resume.
- **Anyone with a real email can buy**, signed in or not. Guests enter an email; it must pass `checkEmailAllowed` (no temp mail, domain must accept mail). A signed-in buyer must have a **username** before buying (ask them to set one in their profile; error code `USERNAME_REQUIRED`).
- After payment a **link goes to the buyer's email** (`/t/<accessToken>`) that opens their tickets with the QR. Signed-in buyers also see them in the **Orders page** (a Tickets section) and `/tickets`. If a guest later signs up / signs in with the same (verified) email, their earlier purchases appear automatically (claimed lazily in `GET /api/tickets/mine`).
- **Security of the QR**: each ticket has its own `secret`. The QR text is a 30-second rotating HMAC (`lib/tickets/qr.ts`, recipe in its header comment; known-answer vector below). A screenshot dies in about a minute. The secret changes on every transfer. When a ticket is scanned it becomes `CHECKED_IN` atomically, the page shows "Checked in", and it can never be used again.
- **Send to a friend**: owner chooses "Send to a friend", is warned this deactivates it for them, types the friend's **username**; it must match an existing active user (exact normalized match, not self). Then ownership moves, secret rotates, both get notified. Guests (no account) cannot transfer; they are told to sign up with the same email first.
- **Resale**: any **seller** can put an event's tickets in their shop (`TicketListing`) and sell them at the host's price (price is never editable). Non-sellers who press "Sell tickets" are sent through `/become-seller` and brought back to continue. The host decides the commission % per tier; it is paid to the reseller from the host's share. Unique sellers (named by username by the host per event) earn `uniqueCommissionPct`; everyone else `randomCommissionPct`. A reseller who is the host or the buyer earns nothing (sale counts as DIRECT).
- **Checkers** (door staff): the host adds an **email**; the checker gets a unique link `/checkin/<token>`. On that page they type the same email to sign in, then scan. A checker session is limited to **that one event**; scanning another event's ticket returns WRONG_EVENT. Every scan (good or bad) is logged with the checker and the ticket holder's username.
- **Money** (`lib/tickets/money.ts`, `purchase.ts`): BataMart takes **10%** of each ticket; reseller commission comes out of the host's share; the host's share and the commission are credited to `availableBalance` **immediately at payment**. **No escrow, no refunds, no disputes.** Ticket earnings can be withdrawn through the normal wallet withdrawal once above the usual minimum.
- **Reminders** to ticket holders: 3 days before, the day before, the morning of. In-app + push + email; guests by email.
- **Audit**: the host can see everything about their event: every purchase (buyer username/email, which seller), per-seller performance (direct / random / unique), transfers, scans per checker, status changes.
- Event **cancelled/not held = no refunds** (owner's decision). Cancelling still needs a strong confirmation and notifies holders.

## 2. Data model

See `prisma/schema.prisma` (TicketEvent, TicketTier, EventChecker, EventSeller, TicketListing, TicketPurchase, Ticket, TicketTransfer, TicketScan) and migration `prisma/migrations/20261110090000_ticketing`. **The migration is not applied to the live database by agents. Never run `prisma migrate` or touch the live DB.**

## 3. Shared library (already written, do not rewrite; extend only if needed and say so)

- `lib/tickets/config.ts` constants
- `lib/tickets/money.ts` `splitTicketMoney`, `naira`
- `lib/tickets/qr.ts` `buildQrText`, `parseQrText`, `verifyQr`, `qrStepOf`, `msUntilNextStep` (isomorphic, Web Crypto)
- `lib/tickets/codes.ts` code/secret/token generation, `sha256Hex`
- `lib/tickets/email-guard.ts` `checkEmailAllowed`, `normalizeEmail`
- `lib/tickets/checker-session.ts` `issueCheckerSession`, `getCheckerFromRequest`
- `lib/tickets/purchase.ts` `prepareSale`, `createPendingPurchase`, `settlePurchase`, `availableForTier`, `TicketError`
- `lib/tickets/notify.ts` `notifyPurchasePaid`, `ticketsLinkForGuest`, `formatEventWhen`
- `scripts/test-tickets-core.ts` pure-logic tests (`npx tsx scripts/test-tickets-core.ts`)

QR known-answer vector (code `BT-ABCDEFGH`, secret `secret`, time 1700000000000 ms): `BT1.BT-ABCDEFGH.56666666.1fc8d6f136d3cdff`.

## 4. URL map

Web pages: `/events` (public list), `/events/[id]` (public detail + buy; `?ref=<sellerUserId>` = resale link), `/t/[token]` (public, from the email), `/tickets` and `/tickets/[id]` (signed in), Orders page gets a Tickets section, `/my-shop/events` (host list), `/my-shop/events/new`, `/my-shop/events/[id]` (manage + dashboard), `/my-shop/tickets` (my resale listings + earnings), `/checkin/[token]` (checker, public page outside the marketplace shell), `/admin/events` (review).

## 5. API contract (JSON; errors are `{ error: string, code?: string }`)

Auth for users: `getUserFromRequest(request)` (Bearer token or cookie). Checkers: `getCheckerFromRequest(request)`. Rate-limit anything public with `checkRateLimitDistributed`. State-changing user routes use `enforceJsonRequest` / `enforceSameOrigin` like `app/api/wallet/topup/route.ts` where the client is a browser (the Flutter app sends Bearer and no Origin: copy how the existing app-facing routes handle that).

### Public / buyer
- `GET  /api/tickets/events?search=&sellerId=&page=` -> `{ events: [{ id, name, venue, startsAt, flyerUrl, fromPrice, soldOut, hostName }] }` (ACTIVE and not over; `sellerId` = events that seller is reselling)
- `GET  /api/tickets/events/[id]?ref=` -> `{ event: { id, name, description, venue, address, startsAt, endsAt, flyerUrl, hostName, hostUsername, allowResale }, tiers: [{ id, name, description, imageUrl, price, available, saleOpen, saleMessage }], reseller: { id, name, username } | null }`
- `POST /api/tickets/checkout` body `{ eventId, tierId, quantity, method: 'CARD'|'WALLET', email?, resellerId?, pin? }`. Guests: CARD only, `email` required. Returns CARD `{ authorizationUrl, reference }` (Flutterwave hosted page, same call shape as `app/api/wallet/topup/route.ts`, `redirect_url` = `/api/tickets/verify`, `meta: { purpose: 'TICKET_PURCHASE', purchaseId }`); WALLET `{ ok: true, purchaseId }` (needs wallet PIN, reuse `lib/wallet/pin.ts` exactly like `app/api/payments/wallet-pay/route.ts`).
- `GET  /api/tickets/verify?tx_ref=&transaction_id=&status=` Flutterwave redirect. Verify with Flutterwave (like `wallet/topup/verify`), check `tx_ref`, currency NGN, `meta.purpose`, amount == `subtotal`, then `settlePurchase` (CARD), `notifyPurchasePaid`, redirect to `/t/<accessToken>?paid=1` (guests) or `/tickets?purchase=<id>&paid=1`. Failure: redirect `/events/<id>?payment=failed`. Idempotent.
- `GET  /api/tickets/t/[token]` -> `{ event, buyerEmail(masked), tickets: [{ id, code, tierName, status, secret, secretVersion, checkedInAt }], serverTime }`. Only tickets of that purchase **still owned by the purchase's buyer email** are returned. Token is a bearer credential: rate limit by IP.
- `GET  /api/tickets/mine` (auth) -> `{ tickets: [{ id, code, status, checkedInAt, tierName, event: { id, name, venue, startsAt, flyerUrl } }] }` (secrets NOT included). First claims guest purchases made with this user's email (set `buyerUserId`, and `ownerUserId` on tickets still owned by that email, atomically).
- `GET  /api/tickets/ticket/[id]` (auth owner, or `?token=<purchase accessToken>` for a guest) -> full ticket incl. `secret`, `secretVersion`, `status`, `checkedInAt`, `event`, `serverTime`. Polled every ~4 s by the ticket page so "Checked in" appears quickly.
- `POST /api/tickets/ticket/[id]/transfer` body `{ toUsername }` (auth owner; ticket VALID; event not over). Atomic guarded update (`updateMany` where id, ownerUserId = me, status VALID). Sets owner to the friend (`ownerUserId`, `ownerEmail`), new `secret`, `secretVersion + 1`, creates `TicketTransfer`, notifies both (in-app + push + email to the friend), AuditLog.
- `GET  /api/tickets/lookup-user?username=` (auth) -> `{ found: boolean, name?: string }` (first name + initial only; rate limited) so the UI can confirm the friend before sending.

### Resale
- `GET  /api/tickets/listings/mine` (auth seller) -> `{ listings: [{ id, eventId, eventName, startsAt, isActive, kind: 'RANDOM'|'UNIQUE', ticketsSold, commissionEarned, tiers: [{ name, price, commissionPct }] }] }`
- `POST /api/tickets/listings` body `{ eventId }` (auth seller) -> creates/reactivates a `TicketListing`; 403 `NOT_SELLER` if not a seller (UI then goes to `/become-seller?next=...`); event must be ACTIVE with `allowResale`.
- `DELETE /api/tickets/listings/[id]` (auth owner) -> deactivates.

### Host (auth; must be the event's host)
- `GET  /api/tickets/host/events` -> `{ events: [{ id, name, status, startsAt, ticketsSold, capacity, revenue }] }`
- `POST /api/tickets/host/events` body `{ name, description?, venue, address?, startsAt, endsAt?, flyerUrl, allowResale, tiers: [{ name, description?, imageUrl?, price, capacity, randomCommissionPct, uniqueCommissionPct, saleStartsAt?, saleEndsAt? }], checkerEmails?: string[], sellerUsernames?: string[] }` -> `{ id }`, status PENDING_REVIEW, notifies admins. Validates every limit in `config.ts`; a username that does not exist is an error naming it (no silent skips).
- `GET  /api/tickets/host/events/[id]` -> full dashboard: `{ event, tiers (with sold/available), totals: { ticketsSold, grossSales, platformFee, commissionPaid, hostEarnings, checkedIn }, sellers: [{ kind, userId, name, username, ticketsSold, grossSales, commission }], checkers: [{ id, email, name, isActive, lastLoginAt, scanCount, okCount }], purchases: [{ id, createdAt, buyerLabel (username or email), via (DIRECT|seller username), kind, tierName, quantity, amount }] }` (paginated purchases)
- `PATCH /api/tickets/host/events/[id]` edit event fields and tiers (rules in section 7).
- `POST /api/tickets/host/events/[id]/checkers` `{ email, name? }` -> create + email the sign-in link; `POST .../checkers/[checkerId]/resend` (new token, bump `sessionVersion`); `DELETE .../checkers/[checkerId]` (deactivate, bump `sessionVersion`).
- `POST /api/tickets/host/events/[id]/sellers` `{ username }` -> must exist; `DELETE .../sellers/[sellerRowId]`.
- `GET  /api/tickets/host/events/[id]/audit?cursor=` -> merged timeline (purchases, transfers, scans, status changes).
- `POST /api/tickets/host/events/[id]/cancel` `{ confirm: true }` -> CANCELLED, notifies holders, AuditLog. No refunds.

### Host response details (as built; the apps read exactly these)
- List row also has `venue, flyerUrl, earnings, reviewNote` (note only when REJECTED). Dashboard `event` has `reviewNote` (admin note on reject/pause, null otherwise) and `hasPaidTickets`; tiers have `isActive`, `sold`, `available`; sellers carry `rowId` (null for DIRECT; use it for DELETE .../sellers/[rowId]); purchases paginate with `?pcursor=` and `purchasesNextCursor`; `scans` = latest 50 `{ id, result, holder, tierName, createdAt, checker }`.
- Audit: `{ items: [{ at, type: PURCHASE|TRANSFER|SCAN|CHANGE, text }], nextCursor }` (cursor is an ISO date).
- PATCH: `tiers[]` entries with `id` edit (incl. `isActive`), entries without `id` create a tier (name, price, capacity required); `removeTierIds` deletes tiers with no sales. Dates are ISO strings, money is whole naira.
- Errors: 403 `NOT_SELLER`, 400 `USERNAME_REQUIRED`, `UNKNOWN_USERNAME`, `CONFIRM_REQUIRED`.

### Checker
- `POST /api/tickets/checker/login` `{ token, email }` -> token is looked up via `sha256Hex(token)`; email must equal the invited email (case-insensitive); returns `{ sessionToken, event }` and sets cookie `checkerToken` (httpOnly, secure, sameSite lax, path `/`). Rate-limit by IP and by token.
- `GET  /api/tickets/checker/me` -> `{ checker, event, stats: { checkedIn, total, myScans } }`
- `POST /api/tickets/checker/scan` `{ qr }` -> parse (`parseQrText`), load ticket by code, **event must equal the checker's event** (else `WRONG_EVENT`, reveal nothing about the other event), `verifyQr(secret)`; VALID -> `updateMany({ id, status: 'VALID' } -> CHECKED_IN, checkedInAt, checkedInById })` and success only if count === 1 (race-safe); log a `TicketScan` for EVERY attempt with result `OK | ALREADY_USED | INVALID | WRONG_EVENT | STALE | VOID`, holder label and tier. Response `{ result, message, ticket?: { code, tierName, holder, checkedInAt } }`. Rate limit per checker.
- `GET  /api/tickets/checker/log` -> recent scans for this checker's event.

### Admin (`/api/admin/**` is already protected by middleware)
- `GET  /api/admin/tickets/events?status=` and `POST /api/admin/tickets/events/[id]` `{ action: 'approve'|'reject'|'pause'|'resume', note? }`; notifies the host, writes AuditLog (`entityType: 'TicketEvent'`). Also a read-only stats/overbooked view.

## 6. Status transitions

`PENDING_REVIEW -> ACTIVE | REJECTED`; `ACTIVE <-> PAUSED`; `ACTIVE|PAUSED -> CANCELLED`; `REJECTED -> PENDING_REVIEW` when the host edits and resubmits. Only `ACTIVE` events are public/sellable.

## 7. Edit rules (host)

- Tier price/commissions/capacity/sale window can change anytime for future sales; capacity can never go below `sold`; a tier with sales cannot be deleted (deactivate instead).
- `name`, `venue`, `startsAt`, `endsAt` on an event **with no paid tickets**: edit goes back to `PENDING_REVIEW`. On an event **with paid tickets**: applied immediately, AuditLog with old/new values, all holders notified, admins notified so they can pause if it looks like bait-and-switch.

## 8. Style and safety rules for everyone

- Follow the surrounding code's style. Icons are **lucide-react**, never emoji, in UI. Reuse the existing UI kit (`components/ui`, `components/marketplace`, `.ui-*` CSS, Shell/AdminUI) before hand-rolling cards/forms/tables; study a nearby page first.
- Never print or log secrets or ticket `secret`s. Never return `secret` from list endpoints.
- Never trust the client: eventId/checker scope comes from the session, amounts from the database, ownership from the token.
- All money in whole naira (`Int`). Use `lib/tickets/purchase.ts` for anything that moves money.
- Do not run `prisma migrate`, `prisma db push`, or anything against the live database. Do not edit `.env`. `npx tsc --noEmit` has pre-existing errors (downlevelIteration, etc.): filter by the files you touched. Flutter: `flutter analyze lib` filtered to your files.
- Do not edit files another agent owns (section 9). If you need a small change in a shared file, make the smallest localized edit and re-read the file immediately before editing.

## 9. Ownership (to avoid edit collisions)

| Area | Owns |
|---|---|
| Host (web + API) | `app/api/tickets/host/**`, `app/(marketplace)/my-shop/events/**`, link card on `app/(marketplace)/my-shop/page.tsx`, `lib/tickets/host-mail.ts` |
| Buyer (web + API) | `app/api/tickets/{events,checkout,verify,t,mine,ticket,lookup-user}/**`, `app/(marketplace)/{events,tickets}/**`, `app/(marketplace)/t/**` (or `app/t/**`), Orders page Tickets section, marketplace/navbar entry points |
| Resale | `app/api/tickets/listings/**`, `app/(marketplace)/my-shop/tickets/**`, `app/(marketplace)/become-seller/page.tsx` (`next` param), seller shop page Tickets section, "Sell these tickets" button component used on the event page |
| Checker | `app/api/tickets/checker/**`, `app/checkin/**`, `components/tickets/Scanner*` |
| Admin + reminders | `app/api/admin/tickets/**`, `app/(admin)/admin/events/**`, admin nav entry, `lib/tickets/reminders.ts`, cron route + `vercel.json`, `lib/notify/jobs.ts` hook |
| Flutter buyer | `batamart_app/lib/features/tickets/**` (buyer side), ticket entry points in home/orders/router |
| Flutter host | `batamart_app/lib/features/tickets_host/**` |
