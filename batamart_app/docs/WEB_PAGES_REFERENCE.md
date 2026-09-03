# Batamart Web App — Page & Navigation Reference

Snapshot of the existing Next.js web app's page inventory, for buyer/seller/rider roles (admin excluded — out of scope for this app). Use this as the feature-parity target: what screens the Flutter app needs, and how they connect. Source: `app/` (Next.js App Router) in the repo root, route groups `(marketplace)` and `(auth)` are URL-transparent.

## How access is enforced on the web (context for designing Flutter's own gating)

- A logged-in RIDER can only reach: rider login, rider dashboard, wallet, notifications. Hitting anything else force-logs them out.
- The rider dashboard route can only be loaded by a RIDER token — everyone else is bounced to rider login.
- Buyers and sellers share one app — role just toggles visible UI (seller-mode adds "My Shop", "Sell", "Sales" nav items) rather than separate route trees.
- Almost every buyer/seller page redirects an unauthenticated visitor to login with a `redirect` param back to itself.

The web app's persistent chrome is a `Navbar` component with three variants: a desktop top bar (search, cart, notification bell, user dropdown), a mobile buyer/seller bottom tab bar (Market / Orders / Sell(+) / Wallet / Profile), and a mobile rider bottom tab bar (Dashboard / Deliveries / Online-Offline toggle / Earnings / Profile). Flutter's own bottom-nav structure should mirror these three "modes."

---

## Shared pages (buyer + seller; two of these are also rider-reachable)

| Page | Purpose | Outbound navigation |
|---|---|---|
| Marketplace (home) | Storefront feed: hero, categories, deals rows, "just dropped" infinite scroll, brand chips | Product card → product detail; "See all" → most-bought / deals; search submit → search results; "Sell" CTA → sell flow; referral popup → referrals |
| Deals | Filterable/sortable "Hot Deals" grid (category, price range, discount range) | Card → product detail; back → previous page |
| Campaign landing (e.g. seasonal promo) | Countdown + campaign-tagged products | Card → product detail |
| Most Bought | "Most bought daily" infinite-scroll feed grouped by day | Card → product detail; back → previous page |
| Search | Full search/filter/sort UI (category tree, price slider, attribute filters, grid/list view) | Card → product detail; back → marketplace |
| Product Detail | Image gallery, variant selection, qty, Add to Cart / Buy Now, reviews tab, related-products rails, report-product modal, share | Buy Now → checkout (or login if logged out); seller name → seller profile; breadcrumb → marketplace; related cards → other product details |
| Product Reviews (full list) | Rating distribution + filter/sort for one product's reviews | Back → product detail |
| Seller Directory | Public, searchable list of sellers | Card → seller profile / seller's product catalog |
| Seller Profile | Rating, bio, join date, product grid, reviews | "View all" → seller's full catalog; product tiles → product detail |
| Seller's Full Catalog | Paginated product list for one seller | Tabs: Profile, Reviews; cards → product detail |
| My Profile | Account hub: profile edit, push-notification/biometric/dark-mode toggles, referral card, wallet balance chip, recently-viewed strip, PWA install prompt | Sidebar → Marketplace, My Shop/Sell (sellers only), Orders, Wallet, Referrals, Disputes (hidden for riders); Logout → landing page |
| Wallet | Balance, escrow amount, transaction history, withdraw modal (bank/PIN/biometric), PIN set/change/forgot modals | Back → marketplace. **Rider-reachable** — label swaps to "Earnings" for riders |
| Notifications | Full notification list, mark-read/delete/filter | Each item deep-links by type: order detail, wallet, profile, referrals, dispute detail, product detail, or my-shop. **Rider-reachable** |
| Referrals | Referral code/link, share buttons, stats & history | → Wallet |
| Order Detail | Universal — same screen renders differently depending on whether the viewer is the buyer, seller, or rider on that order | → Product detail, seller profile, review-product, review-seller, file-dispute, dispute-tracking; shows a live rider-location map to the buyer while the order is in an active delivery state |
| Dispute: Select Order | Lists the user's delivered orders eligible for a dispute + already-disputed ones (hidden from riders) | Card → file-dispute for that order; existing-dispute row → order detail |
| Report | Generic "report a product / report a rider" form, prefilled via query param | Cancel → back; submit success → orders |
| Login / Signup / Forgot Password / Verify OTP / Profile Setup (address & hostel) | Standard auth chain for buyers/sellers | Chains: signup → verify → profile setup (only if no hostel on file yet) → marketplace |
| Become a Seller | Onboarding for a buyer to upgrade to seller status: benefits, PIN-security explainer, requirements | Success screen → List first product, Set withdrawal PIN, Go to marketplace |

## Buyer-specific pages

| Page | Purpose | Outbound navigation |
|---|---|---|
| Cart | Line items with qty steppers, variant chips/notes, live zone-based delivery-fee quote, order summary | Item → product detail; seller name → seller profile; "Change options" → product detail; "Secure checkout" → checkout; empty state → marketplace |
| Checkout | Delivery-address summary, per-item order notes (auto-filled from selected variants), escrow explainer, delivery-suitability confirmation checkbox, pay button | "Back to Cart" → cart; "Edit" address → profile setup; pay → external payment gateway redirect, then back to Orders on success/failure; missing hostel → profile setup; logged out → login |
| Orders (buyer's own) | Order history, post-payment success celebration, "People Like You Bought" carousel, per-order status badges and actions | "Shop More" → marketplace; "Selling" shortcut (if also seller) → seller sales list; "View Details" → order detail; "Review Product" / "Review Seller" → respective review forms; "Confirm Received" → in-page action, no navigation |
| File a Dispute | Reason dropdown, description, evidence upload, pickup-address confirmation, for one specific order | Cancel → back; success → dispute tracking page |
| Review Product | Star rating + comment for the purchased product | Skip → orders; success → chains into Review Seller |
| Review Seller | Star rating + comment for the seller on that order | Skip → orders; success → orders |

## Seller-specific pages

| Page | Purpose | Outbound navigation |
|---|---|---|
| Sell (create listing) | Multi-step form: category/subcategory, images, variants/attributes, price, optional campaign opt-in, pre-submit confirmation modal showing the platform fee (5%) breakdown | Cancel → become-seller (if not yet seller) or marketplace; logged out → login; success → My Shop |
| My Shop | Seller's inventory dashboard: stats (listed/active/out-of-stock/orders), search/filter, grid/list toggle, per-product actions (View, Pause/Activate, Restock, Delete). Shows a "buyer mode" empty state when seller-mode is off. | "Add Product" → Sell; product "View" → product detail; buyer-mode empty state → Browse Marketplace / View My Orders |
| Sales (incoming orders) | Orders placed by buyers against the seller's products: buyer info, delivery address, order notes, "Accept Order" action (moves PENDING → PROCESSING) | "My Orders" shortcut → buyer Orders page; "View details" → order detail; empty state → marketplace |

## Rider-specific pages

Enforced as the rider's **only** reachable surface, plus Wallet and Notifications from the shared list above.

| Page | Purpose | Outbound navigation |
|---|---|---|
| Rider Login | Rider-specific credential login | Success → rider dashboard; "Not a rider?" → regular login |
| Rider Dashboard | Core workspace: available delivery **batches** (one seller = one leg; multiple legs from one buyer's order = one batch, accepted as a unit), "My Active Batches" with per-order status-advance actions (Picked Up → On the Way → Delivered), dispute-pickup jobs, live GPS broadcast toggle (feeds the buyer's live-tracking map), online/offline availability toggle | Almost entirely self-contained — status/availability changes are in-page actions, not navigation. Unauthenticated → rider login |
| Rider bottom nav (persistent chrome, not its own page) | Dashboard / Deliveries (same dashboard, different internal tab) / online-offline toggle / Earnings / Profile | Earnings → Wallet; Profile sheet → Dashboard, Earnings, Notifications, Logout (→ rider login) |

---

## Known rough edges in the web app (don't blindly replicate)

- Two "reviews" sub-routes (`products/[id]/reviews` under an alternate path, and a `sellers/[id]/reviews` linked from the seller catalog's "Reviews" tab) are unstyled placeholder/dummy pages, not the real reviews UI — looks like leftover scaffolding. Build the Flutter reviews screens against the real, styled review data/behavior (ratings + comments tied to an order), not against these stubs.
- "My Shop" and "Wallet" are same-URL-different-content-by-role on the web (buyer-mode empty state vs. seller inventory; "Orders"/"Earnings" label swap for riders). In Flutter this is more naturally two different screens gated by role, but the underlying data source is the same API.
