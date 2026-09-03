# UI/UX Mockups

Save the actual mockup image file(s) in this folder. This README describes the first collage the user
supplied, so the content is searchable/referenceable even before the image itself is opened.

**Expected file**: save the full collage as `docs/mockups/collage_v1.png` (or similar) so `CLAUDE.md` and
`BUILD_PLAN_12_PHASES.md` can point at a stable path. If more collages/individual screens are added later,
add them here and update this list.

## Legend (from the collage's own key)

- **Blue** — Shared (Buyer + Seller)
- **Darker blue** — Buyer only
- **Orange** — Seller only
- **Green** — Rider only

## Screens visible in `collage_v1`

Shared / onboarding (blue):
- Logo splash ("Everything you need, delivered")
- Welcome Back / Login (email or phone + password, Google/Facebook continue)
- Marketplace home (search bar, "Girlfriend's Day" campaign banner, Hot Deals row, Just Dropped row)
- Hot Deals grid (category filter tabs: All/Fashion/Electronics/Beauty)
- Product Detail (image, price, size selector, description, Add to Cart / Buy Now)
- Cart (line items, delivery address + fee, Secure Checkout)

Buyer-leaning (still blue in the collage, functionally buyer-specific per `WEB_PAGES_REFERENCE.md`):
- Checkout (delivery address, order notes, escrow protection explainer, order summary, "Pay with
  Flutterwave")
- My Orders (tabs: All/To Pay/Processing/On the way/Delivered)
- Order Tracking (status stepper, rider card with call/message, live map, "View Rider Live Location")
- Wallet (escrow balance, Withdraw, Add Money/Transactions/Withdraw/PIN quick actions, recent
  transactions)
- Notifications (order/payment/promo/delivery items)
- Referrals (referral code + share, stats, recent referrals list)
- My Profile (Addresses, Payment Methods, Biometric Login toggle, Dark Mode toggle, Logout)

Seller pages (orange border in the collage):
- My Shop (Products/Orders/Earnings stat tiles, Manage Products list, "Add New Product", low-stock alert)
- Sell / Add Product (numbered multi-step: 1 Basic Info → 2 → 3 → 4, image upload grid, product name
  field)
- Orders (seller) (tabs: New/Processing/Completed, per-order Accept action)

Rider pages (green border in the collage):
- Rider Home ("Good morning, {name}", online/offline toggle, Available Batches list with Accept, Active
  Delivery card)
- Rider Earnings / Wallet (Available Balance + Withdraw, Today/This Week/This Month tiles, Recent
  Earnings list)
- Rider Deliveries (tabs: Active/Completed, per-order Navigate action)

## Resolved: rider bottom nav

Every frame in the collage — buyer, seller, *and* rider pages — shows the same 5-icon bottom nav (Home,
Deals, Cart, Orders, Profile), but this was confirmed a **template artifact**, not intentional. Disregard
the bottom nav icons shown in the rider-page frames specifically. Build the rider nav per
`WEB_PAGES_REFERENCE.md` instead: a structurally separate shell (Dashboard / Deliveries / online-offline
toggle / Earnings / Profile), no Home/Deals/Cart tabs, and the server-side walled-garden restriction
(riders blocked from marketplace/cart/deals entirely) stays in place unchanged. Reuse the rider mockup
frames only for their *visual style* (colors, cards, typography) — restyle them onto the correct nav
structure, don't port the nav bar itself.
