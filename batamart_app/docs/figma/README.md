# BataMart mobile — Figma file

`BataMart-Mobile.svg` is the Flutter app (`batamart_app/`) drawn as a Figma canvas: ten
390 × 844 screens plus a style-guide board, all on one canvas.

## Importing

1. Open [figma.com](https://figma.com), create or open a design file.
2. Drag `BataMart-Mobile.svg` onto the canvas (or **File → Place image / Import**).
   Figma converts it into editable layers — text stays text, shapes stay vectors,
   the photographs come in as image fills.
3. Zoom to fit. Each screen is its own named group (`01 · Log in`, `02 · Home — top of
   feed`, …). To turn one into a real frame: select the group → right-click →
   **Frame selection**.

### Fonts

The file uses the four faces the app bundles, all available in Figma:
**Archivo** (headings, prices), **Inter** (body), **Instrument Serif** (the italic
editorial accent), **JetBrains Mono** (eyebrows, badges, metadata). If Figma prompts
for a missing font, install it from Google Fonts or let Figma substitute — nothing else
about the layout depends on it.

## What is in it

| Frame | Source |
|---|---|
| 01 Log in | `features/auth/presentation/login_screen.dart`, `core/widgets/auth_scaffold.dart` |
| 02–04 Home | `features/marketplace/presentation/marketplace_home_screen.dart` + `widgets/home_sections.dart` |
| 05 Deals | `features/marketplace/presentation/deals_screen.dart` |
| 06 Product detail | `features/marketplace/presentation/product_detail_screen.dart` |
| 07 Cart | `features/cart/presentation/cart_screen.dart` |
| 08 Checkout | `features/checkout/presentation/checkout_screen.dart` |
| 09 Orders | `features/orders/presentation/orders_screen.dart` + `core/widgets/cards/order_card.dart` |
| 10 Profile | `features/home/presentation/buyer_seller_home_shell.dart` |
| Style guide | `core/theme/app_palette.dart`, `app_typography.dart`, `app_spacing.dart` |

Colours, type sizes, spacing, radii, the bottom nav, buttons, chips and the product card
are read from those files rather than approximated. Photographs are the app's own
`assets/images/*.webp`, re-encoded as embedded JPEGs. Product names, prices and order
numbers are plausible sample data — the real ones come from the API.

Only the light theme is drawn. The dark palette is in `app_palette.dart` if a dark board
is wanted later.

## Regenerating

After a UI change, rebuild rather than hand-editing the SVG:

```bash
python _generator/build.py BataMart-Mobile.svg
```

Needs Python with Pillow. `_generator/icons.json` holds the Lucide icon geometry,
extracted from `node_modules/lucide-react` so the icons are the real ones.
