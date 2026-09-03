# Batamart — Flutter Client

This folder is the **Flutter mobile app** for Batamart, a single-university (UNIZIK) student marketplace with zone-based delivery. It is a **client only** — there is no backend code here. The real backend (Next.js App Router + Prisma + PostgreSQL) lives at the root of this same git repo, one level up (`../../`), but a session rooted in this folder should NOT assume it can read that code — treat the two docs below as the source of truth instead, since they were written specifically to be self-contained.

## Read before building any screen

- **`docs/BACKEND_REFERENCE.md`** — the API contract: base URL, auth flow (JWT bearer tokens, header format, a same-origin CSRF check that must be worked around for mobile), every relevant endpoint (method, path, request/response shape, auth requirement), the Prisma data models, and the business rules that aren't obvious from an endpoint name (zone-based delivery pricing, escrow, rider delivery batches, PIN/biometric withdrawal, referral rewards, campaign tags, dispute flow, suspension/penalty system).
- **`docs/WEB_PAGES_REFERENCE.md`** — the existing web app's full page inventory for buyers, sellers, and riders: what each page does and every button/link that navigates elsewhere. Use this as the feature-parity spec for what Flutter screens should exist and how they should connect — the goal is equivalent functionality, not a pixel port of the React UI.
- **`docs/BUILD_PLAN_12_PHASES.md`** — the master build plan. If the user references "a phase" or "the plan," this is it. Read it before starting any phase — it has per-phase scope, references, open decisions, and a Definition of Done, plus a Progress Tracker table to update when a phase finishes.

## Ground truth over these docs

These docs are a snapshot. If a request/response shape or business rule ever seems to not match what the live API actually returns, trust the API's actual behavior (test it) over the doc, and flag the mismatch back to the user so the doc can be corrected — don't silently build around a stale assumption.

## Visual design

The UI/UX is being **completely redesigned** for this app — do not copy the old web app's look, layout, or component styling. The user will supply mockup images for every screen; build to those. `docs/WEB_PAGES_REFERENCE.md` is a *functional* spec only (what each screen does, what every button/link navigates to) — treat its navigation graph as fixed (same destinations, no new/removed routes, no new/removed buttons) but treat its visual description as irrelevant.

## Non-negotiable constraints

1. **Same database, same backend, no parallel API.** This app calls the existing Next.js `/api/*` routes over HTTPS. Do not invent new backend endpoints or a second data layer.
2. **Three roles, one account system**: BUYER, SELLER, RIDER (ADMIN exists but is explicitly out of scope for this app). A user's `role` and `isSellerMode` flag determine what UI to show — see BACKEND_REFERENCE.md.
3. **Auth**: login endpoints return a JWT in the JSON response body (not just a cookie) specifically so non-browser clients can use it. Store it securely (`flutter_secure_storage`) and send `Authorization: Bearer <token>` on every authenticated request.
4. **Riders are walled off** from all buyer/seller flows server-side (see middleware notes in BACKEND_REFERENCE.md) — don't build a rider screen that assumes access to buyer/seller-only endpoints.
5. Icons: use a proper icon set (e.g. Material/Cupertino icons or `lucide` equivalents) for UI badges/status indicators — not emoji.
