# BataMart Design Bible
### The single source of truth for BataMart's visual and interaction design.

This document is version-controlled and lives in the repo root. Every future design or frontend prompt to Codex should say: *"Read BATAMART_DESIGN_BIBLE.md in full and treat it as the single source of truth before making any change."* Business logic, APIs, database schema, auth, and payment integrations are never in scope for changes driven by this document — it governs frontend visual and interaction design only.

---

## 1. Brand identity

**What BataMart is:** a trustworthy, fast, no-nonsense campus marketplace. The tone is competent and calm, not playful or gimmicky. Every design decision should ask: *does this make a first-time buyer trust that this platform will deliver their order and protect their money?*

**What BataMart is not:** a gamified app, a growth-hack template, a "fun startup" aesthetic. No confetti, no countdown-timer urgency tactics as a primary UI pattern, no emoji, no mascots.

**Reference points (inspiration only — never copy):** Amazon (density, discoverability), Jumia (African e-commerce familiarity, category structure), Shein (mobile browsing, product grid rhythm), Apple (whitespace, restraint, typographic confidence), Shopify (card and layout polish).

---

## 2. Color system

Use these values exactly. No other hex codes are permitted anywhere in the app outside this table.

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#1E90FF` | The ONLY accent color in the app. Buttons, active states, links, selected states, primary icons. |
| `--color-background` | `#FFFFFF` | Page background. |
| `--color-surface` | `#F8FAFC` | Card backgrounds, section backgrounds, input backgrounds. |
| `--color-border` | `#E5E7EB` | All borders and dividers. |
| `--color-text-primary` | `#111827` | Headings, primary body text. |
| `--color-text-secondary` | `#6B7280` | Supporting text, labels, metadata. |
| `--color-text-muted` | `#9CA3AF` | Placeholders, disabled text, timestamps. |
| `--color-success` | `#22C55E` | Status only: in stock, delivered, confirmed. Never decorative. |
| `--color-danger` | `#EF4444` | Status only: errors, out of stock, destructive actions. Never decorative. |
| `--color-warning` | `#F59E0B` | Status only: pending, low stock, attention-needed states. Never decorative. |

**Rule:** if a color isn't in this table, it doesn't go in the codebase. If a designer/Codex wants to introduce purple, pink, orange, or a second blue "for variety," the answer is no — that instinct is exactly what created the original AI-generated look. Products carry visual variety through their photography; the interface itself stays neutral.

**Gradients:** banned everywhere, no exceptions. Every fill is a flat, solid value from the table above.

---

## 3. Typography

- **Font:** Inter, loaded via `next/font` or self-hosted — not a Google Fonts CDN call that can fail.
- **Weights used:** 400 (regular), 500 (medium), 600 (semibold). Never go above 600. No 700/800/900 — they read as heavy/shouty against this palette.
- **Scale** (use these exact sizes, nothing in between):

| Role | Size | Weight | Line height |
|---|---|---|---|
| Display (hero headline) | 40px | 600 | 1.15 |
| H1 (page title) | 28px | 600 | 1.2 |
| H2 (section title) | 20px | 600 | 1.3 |
| H3 (card title) | 16px | 500 | 1.4 |
| Body | 15px | 400 | 1.6 |
| Small / metadata | 13px | 400 | 1.5 |
| Caption / timestamp | 12px | 400 | 1.4 |

- **Sentence case everywhere** — buttons, headings, nav items, card titles. Never Title Case, never ALL CAPS (the one exception: small functional badges like "NEW" or "SOLD" may be caps at 11px, tracked out slightly, and only in a status color).
- No gradient text, no outlined text, no decorative/script fonts anywhere.

---

## 4. Spacing system (8-point grid)

All spacing, padding, and margin values must be a multiple of 4px, and preferably of 8px. Never use arbitrary values like 13px or 22px for spacing.

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`

- Card internal padding: 16px (mobile), 24px (desktop)
- Gap between cards in a grid: 12px (mobile), 16px (desktop)
- Section vertical spacing: 32px (mobile), 48px (desktop)
- Page horizontal margin: 16px (mobile), 24–32px (tablet), auto-centered with max-width 1280px (desktop)

---

## 5. Border radius & elevation

- Buttons, inputs, pills: 8px
- Cards: 12px
- Modals/sheets: 16px (top corners only on mobile bottom sheets)
- Avatars, status dots: fully round (999px)
- **Shadows:** minimal. One soft shadow token only: `box-shadow: 0 1px 2px rgba(17,24,39,0.06), 0 1px 3px rgba(17,24,39,0.08)`. No glow, no colored shadows, no heavy drop shadows. Prefer a 1px `--color-border` border over a shadow wherever either would work — borders read as more professional/dense than shadows.

---

## 6. Iconography

- **Library:** `lucide-react` exclusively. No emoji anywhere in any `.tsx`/`.jsx` file, no other icon library mixed in.
- **Style:** outline icons only. Never filled/solid variants.
- **Stroke width:** 1.75px everywhere, no exceptions.
- **Sizing:** 16px (inline with text), 20px (buttons, list items), 24px (section headers, empty states) — no other sizes.
- **Color:** icons inherit the surrounding text color (`currentColor`) by default. The only icons allowed to render in `--color-primary` are ones inside a primary button, an active/selected nav state, or a stat highlighted as the page's single key metric. Status icons (check, alert-triangle, x-circle) use the matching status color.

---

## 7. Logo

Redesign requirements:
- Flat fill, single color (`--color-primary` or `--color-text-primary` depending on context) — no gradient
- Not a generic shopping-bag glyph (avoid the current mark entirely — this silhouette is shared by thousands of auto-generated logos)
- Must work as: a 512px app icon, a 16px favicon, a single-color print mark, and a wordmark-only lockup for tight spaces
- Simple enough to be reconstructed from memory by someone who saw it once — that's the actual test for "memorable"

---

## 8. Component library

Every component below is a single implementation reused everywhere — no page gets a one-off variant.

### Buttons
- Height: 44px (touch target minimum)
- Radius: 8px
- **Primary:** `--color-primary` fill, white text, weight 500. Used for exactly one primary action per screen.
- **Secondary:** white fill, 1px `--color-border`, `--color-text-primary` text. Default choice for most actions.
- **Ghost:** transparent, `--color-text-secondary` text, background appears only on hover.
- **Danger:** `--color-danger` fill or outline, used only for destructive actions (delete listing, cancel order).
- States required for every button: default, hover (8% darken), active (scale 0.98), focus (2px ring in `--color-primary` at 40% opacity), disabled (40% opacity, no pointer events), loading (spinner replaces label, button stays same width).

### Inputs
- Height: 44px, radius 8px, `--color-surface` background, 1px `--color-border`, focus state = 1px `--color-primary` border + 2px outer ring at 15% opacity
- Label above field (13px, `--color-text-secondary`), never placeholder-as-label
- Error state: 1px `--color-danger` border, error message below in 12px `--color-danger`
- Helper text below in 12px `--color-text-muted` when no error

### Cards (generic container)
- White background, 1px `--color-border`, 12px radius, no shadow needed if border is present
- Internal padding per section 5

### Product card (redesigned)
Required elements, in this order: real product photo (1:1 ratio, object-fit cover) → wishlist icon (top-right overlay, 20px, appears on hover on desktop / always visible on mobile) → title (H3, 2-line max with ellipsis) → seller name + verified badge if applicable → star rating + review count (only if reviews exist — no fake/placeholder ratings) → price (bold, `--color-text-primary`) with old price struck through in `--color-text-muted` if discounted → delivery estimate badge (small, neutral gray, not colorful) → stock status only if low/out (status color). Hover state on desktop: 1px border shifts to `--color-border` at full strength + subtle lift via `translateY(-2px)`, no shadow bloom.

### Category card
Real photography or a single lucide icon in `--color-text-secondary` — never emoji. White background, 12px radius, 1px border. Label in H3 style. One link per card ("Shop [category]") in `--color-primary`, never varied per card.

### Badges
Status-based only (in stock / low stock / out of stock / verified seller / new). Background = status color at 10% opacity, text = status color at full value, 12px, weight 500, 4px/10px padding, radius 6px (pill only for very short labels like "NEW").

### Tabs, dropdowns, modals, drawers, breadcrumbs, tables, pagination, toasts, skeleton loaders, empty states, error states
Each gets one canonical implementation using only tokens from sections 2–6 above. Empty states: icon (24px, `--color-text-muted`) + one-line headline + one-line supporting text + a single action button. Never "Nothing here yet" with no path forward. Loading states: skeleton shapes matching the actual content layout, using `--color-surface` with a subtle shimmer — never a spinner-only blank screen for content-shaped areas.

---

## 9. Navigation

**Desktop:** single navbar row — logo, search bar (majority of width), cart/notifications/account on the right. Category strip directly beneath as its own neutral row (not a colored banner). Sticky on scroll.

**Mobile / PWA:** bottom navigation bar (Home, Categories, Sell, Orders, Account) — 5 items max, icons 20px + 11px label, active item in `--color-primary`. Search becomes a dedicated full-width entry point, not squeezed into the top bar. Filters use bottom sheets, not sidebars. Sticky "Add to cart" / "Checkout" bar pinned above the bottom nav on relevant screens.

**Rule:** the PWA is not a shrunk desktop layout. It is designed mobile-first with its own navigation pattern, matching the mental model of Amazon/Shein/Jumia's native apps.

---

## 10. Page-level rules (apply the system above to each)

- **Homepage:** navbar → category strip → live activity (optional, low-key, high-contrast text) → 2–4 discovery modules max on first viewport (not 6+ stacked colorful sections) → category grid using real photography → flat single-color deals module → best sellers/recommendations further down. Generous whitespace between sections (48px desktop).
- **Product page:** real photo gallery, sticky purchase card on desktop (price, stock, primary CTA), specifications, reviews, seller card, related products, delivery/returns info as plain text — not urgency-colored banners.
- **Category/search results:** filter sidebar (desktop, sticky) / bottom sheet (mobile), sort dropdown, grid/list toggle, pagination — no infinite promotional banners injected between products.
- **Cart / checkout:** step indicator using `--color-primary` for the active step only, clean order summary, one primary CTA per screen.
- **Seller dashboard / admin dashboard:** treat as a data-dense SaaS product — tables with 1px borders (not cards-for-everything), charts in `--color-primary` plus grays only, sidebar navigation matching the pattern already correct in the existing `/my-shop` page.
- **Every other page** (auth, wishlist, orders, wallet, referral, disputes, help, 404, etc.): same tokens, same components, no exceptions. A page that hasn't been explicitly listed here still follows every rule in this document.

---

## 11. Accessibility

- All interactive elements keyboard-navigable, visible focus ring (`--color-primary` at reduced opacity), no `outline: none` without a replacement.
- Text contrast must meet WCAG AA against its actual background — check every colored surface, not just the default white background (this has broken before, specifically on ticker/ribbon text).
- Semantic HTML (`<button>` for actions, `<a>` for navigation, proper heading hierarchy), ARIA labels on icon-only buttons, alt text on all product images.

---

## 12. Motion

Subtle and fast only: 150–200ms ease-out for hovers, 200–250ms for modal/drawer entry. No bouncy/overshoot easing, no decorative animation. Motion exists to clarify state changes, never to entertain.

---

## 13. Responsive breakpoints

Support without layout breaks or horizontal scroll at: 320, 375, 390, 414, 768, 1024, 1280, 1440, 1920px. Test the product-card grid and navbar specifically at 320px and 1920px — these are where column-count and whitespace math tends to fail first.

---

## 14. QA checklist (a page is not done until every box is true)

- [ ] Only colors from the section 2 table are present (search the diff for any other hex value)
- [ ] Zero emoji characters anywhere in the file
- [ ] Zero gradient classes/CSS anywhere in the file
- [ ] All icons are `lucide-react`, outline style, 1.75px stroke, consistent sizing
- [ ] All spacing values are multiples of 4
- [ ] Every button/input/card matches the canonical component, not a one-off variant
- [ ] Text contrast checked against actual background, not assumed
- [ ] No dead links, no dead buttons, no unfinished/"coming soon" sections unless explicitly intended
- [ ] Verified at 320px and 1920px with no overflow or broken layout
- [ ] Component reused from the shared library rather than re-implemented locally

---

## 15. How to use this document with Codex

Every future prompt should reference this file by name and instruct Codex to treat it as binding. When a new page or component is discovered mid-audit that isn't explicitly covered above, it still inherits every rule in sections 2–9 and must pass the section 14 checklist before being considered done. This document should be updated (not re-created from scratch) whenever a genuinely new rule is decided — keep it as the durable record so future prompts stay short and this stays the one place all the detail lives.
