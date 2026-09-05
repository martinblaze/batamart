import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/widgets.dart';

/// Mirrors the web app's `CATEGORY_TREE` (`lib/variants.ts` in the main
/// repo) — there is no `/api/categories` endpoint, so this is hardcoded to
/// match the real key/label pairs products are actually created with.
/// `key` is what gets sent as `categoryKey` to `GET /api/products` and
/// `POST /api/products` (BACKEND_REFERENCE.md §3.3); `label` is the
/// display string (also sent as `category`, mirroring the web sell flow).
class ProductCategory {
  const ProductCategory({
    required this.key,
    required this.label,
    required this.icon,
  });

  final String key;
  final String label;
  final IconData icon;
}

const productCategories = <ProductCategory>[
  ProductCategory(key: 'electronics', label: 'Electronics', icon: LucideIcons.smartphone),
  ProductCategory(key: 'computing', label: 'Computing', icon: LucideIcons.laptop),
  ProductCategory(key: 'fashion', label: 'Fashion', icon: LucideIcons.shirt),
  ProductCategory(key: 'home_kitchen', label: 'Home & Kitchen', icon: LucideIcons.house),
  ProductCategory(key: 'groceries', label: 'Food & Groceries', icon: LucideIcons.utensils),
  ProductCategory(key: 'beauty', label: 'Beauty & Health', icon: LucideIcons.sparkles),
  ProductCategory(key: 'sports', label: 'Sports & Fitness', icon: LucideIcons.dumbbell),
  ProductCategory(key: 'vehicles', label: 'Vehicles & Transport', icon: LucideIcons.car),
  ProductCategory(key: 'books', label: 'Books & Stationery', icon: LucideIcons.bookOpen),
  ProductCategory(key: 'tickets', label: 'Tickets & Events', icon: LucideIcons.ticket),
  ProductCategory(key: 'kids', label: 'Kids & Baby', icon: LucideIcons.baby),
  ProductCategory(key: 'arts_crafts', label: 'Arts & Crafts', icon: LucideIcons.palette),
];

/// Subcategories per top-level category key — used by the Sell flow's
/// category/subcategory picker. Also mirrored from `lib/variants.ts`'s
/// `CATEGORY_TREE`.
const productSubcategories = <String, List<ProductCategory>>{
  'electronics': [
    ProductCategory(key: 'phones_tablets', label: 'Phones & Tablets', icon: LucideIcons.smartphone),
    ProductCategory(key: 'laptops', label: 'Laptops', icon: LucideIcons.laptop),
    ProductCategory(key: 'tvs', label: 'TVs & Monitors', icon: LucideIcons.tv),
    ProductCategory(key: 'audio', label: 'Audio & Speakers', icon: LucideIcons.speaker),
    ProductCategory(key: 'cameras', label: 'Cameras & Photography', icon: LucideIcons.camera),
    ProductCategory(key: 'gaming', label: 'Gaming', icon: LucideIcons.gamepad2),
    ProductCategory(key: 'accessories_electronics', label: 'Phone & Laptop Accessories', icon: LucideIcons.cable),
    ProductCategory(key: 'smart_home', label: 'Smart Home & Gadgets', icon: LucideIcons.lightbulb),
    ProductCategory(key: 'printers_scanners', label: 'Printers & Scanners', icon: LucideIcons.printer),
    ProductCategory(key: 'networking', label: 'Networking & Internet', icon: LucideIcons.wifi),
  ],
  'computing': [
    ProductCategory(key: 'laptops_computing', label: 'Laptops', icon: LucideIcons.laptop),
    ProductCategory(key: 'textbooks', label: 'Textbooks & Course Materials', icon: LucideIcons.bookOpen),
    ProductCategory(key: 'stationery', label: 'Stationery & School Supplies', icon: LucideIcons.pencil),
    ProductCategory(key: 'accessories_computing', label: 'Computer Accessories', icon: LucideIcons.mouse),
  ],
  'fashion': [
    ProductCategory(key: 'mens_wear', label: "Men's Clothing", icon: LucideIcons.shirt),
    ProductCategory(key: 'womens_wear', label: "Women's Clothing", icon: LucideIcons.shirt),
    ProductCategory(key: 'mens_shoes', label: "Men's Shoes", icon: LucideIcons.footprints),
    ProductCategory(key: 'womens_shoes', label: "Women's Shoes", icon: LucideIcons.footprints),
    ProductCategory(key: 'bags', label: 'Bags & Backpacks', icon: LucideIcons.briefcase),
    ProductCategory(key: 'watches_jewelry', label: 'Watches & Jewelry', icon: LucideIcons.watch),
    ProductCategory(key: 'fashion_accessories', label: 'Fashion Accessories', icon: LucideIcons.glasses),
    ProductCategory(key: 'uniforms_costumes', label: 'Uniforms & Costumes', icon: LucideIcons.shirt),
    ProductCategory(key: 'wigs_hair', label: 'Wigs, Hair & Extensions', icon: LucideIcons.scissors),
  ],
  'home_kitchen': [
    ProductCategory(key: 'furniture', label: 'Furniture', icon: LucideIcons.armchair),
    ProductCategory(key: 'kitchen_appliances', label: 'Kitchen Appliances', icon: LucideIcons.microwave),
    ProductCategory(key: 'refrigerators_freezers', label: 'Fridges & Freezers', icon: LucideIcons.refrigerator),
    ProductCategory(key: 'bedding_bath', label: 'Bedding & Bath', icon: LucideIcons.bed),
    ProductCategory(key: 'home_decor', label: 'Home Decor & Lighting', icon: LucideIcons.lamp),
    ProductCategory(key: 'cleaning_laundry', label: 'Cleaning & Laundry', icon: LucideIcons.washingMachine),
    ProductCategory(key: 'cookware_utensils', label: 'Cookware & Kitchen Tools', icon: LucideIcons.cookingPot),
  ],
  'groceries': [
    ProductCategory(key: 'cooked_food', label: 'Cooked Food & Meals', icon: LucideIcons.utensils),
    ProductCategory(key: 'snacks_drinks', label: 'Snacks & Drinks', icon: LucideIcons.cookie),
    ProductCategory(key: 'raw_ingredients', label: 'Raw Food & Ingredients', icon: LucideIcons.carrot),
    ProductCategory(key: 'bakery', label: 'Bakery & Pastries', icon: LucideIcons.croissant),
    ProductCategory(key: 'household_consumables', label: 'Household Consumables', icon: LucideIcons.package),
  ],
  'beauty': [
    ProductCategory(key: 'skincare', label: 'Skincare', icon: LucideIcons.sparkles),
    ProductCategory(key: 'makeup', label: 'Makeup & Cosmetics', icon: LucideIcons.palette),
    ProductCategory(key: 'haircare', label: 'Haircare Products', icon: LucideIcons.scissors),
    ProductCategory(key: 'fragrances', label: 'Perfumes & Fragrances', icon: LucideIcons.flower),
    ProductCategory(key: 'health_wellness', label: 'Health & Wellness', icon: LucideIcons.heartPulse),
    ProductCategory(key: 'salon_tools', label: 'Salon & Grooming Tools', icon: LucideIcons.scissors),
  ],
  'sports': [
    ProductCategory(key: 'gym_fitness', label: 'Gym & Fitness Equipment', icon: LucideIcons.dumbbell),
    ProductCategory(key: 'jerseys_sportswear', label: 'Jerseys & Sportswear', icon: LucideIcons.shirt),
    ProductCategory(key: 'sports_shoes', label: 'Sports Shoes', icon: LucideIcons.footprints),
    ProductCategory(key: 'sports_equipment', label: 'Sports Equipment & Gear', icon: LucideIcons.trophy),
  ],
  'vehicles': [
    ProductCategory(key: 'bicycles', label: 'Bicycles', icon: LucideIcons.bike),
    ProductCategory(key: 'car_accessories', label: 'Car Accessories', icon: LucideIcons.car),
    ProductCategory(key: 'motorcycles_scooters', label: 'Motorcycles & Scooters', icon: LucideIcons.bike),
  ],
  'books': [
    ProductCategory(key: 'academic_books', label: 'Academic Books', icon: LucideIcons.bookOpen),
    ProductCategory(key: 'past_questions', label: 'Past Questions & Study Guides', icon: LucideIcons.fileText),
    ProductCategory(key: 'fiction_novels', label: 'Fiction & Novels', icon: LucideIcons.bookOpen),
    ProductCategory(key: 'stationery_supplies', label: 'Stationery & Supplies', icon: LucideIcons.pencil),
  ],
  'tickets': [
    ProductCategory(key: 'concert_show', label: 'Concert & Show Tickets', icon: LucideIcons.ticket),
    ProductCategory(key: 'academic_events', label: 'Academic Events & Conferences', icon: LucideIcons.calendar),
    ProductCategory(key: 'sport_tickets', label: 'Sports Event Tickets', icon: LucideIcons.ticket),
  ],
  'kids': [
    ProductCategory(key: 'toys_games', label: 'Toys & Games', icon: LucideIcons.blocks),
    ProductCategory(key: 'baby_clothing', label: 'Baby & Kids Clothing', icon: LucideIcons.shirt),
    ProductCategory(key: 'baby_gear', label: 'Baby Gear & Equipment', icon: LucideIcons.baby),
  ],
  'arts_crafts': [
    ProductCategory(key: 'art_supplies', label: 'Art Supplies', icon: LucideIcons.palette),
    ProductCategory(key: 'handmade_crafts', label: 'Handmade & Custom Items', icon: LucideIcons.scissors),
    ProductCategory(key: 'musical_instruments', label: 'Musical Instruments', icon: LucideIcons.music),
  ],
};


/// The top-level category a subcategory key belongs to, or null if [key] is
/// already top-level (or unknown).
///
/// The API resolves `subcategoryKey` *within* a parent `categoryKey`
/// (see `resolveSubcategoryKey` in app/api/products/route.ts), so a
/// subcategory filter is meaningless without its parent. Callers need this to
/// send both.
String? parentCategoryOf(String key) {
  for (final entry in productSubcategories.entries) {
    if (entry.value.any((c) => c.key == key)) return entry.key;
  }
  return null;
}

/// Looks up a category or subcategory anywhere in the tree.
ProductCategory? findCategory(String key) {
  for (final c in productCategories) {
    if (c.key == key) return c;
  }
  for (final list in productSubcategories.values) {
    for (final c in list) {
      if (c.key == key) return c;
    }
  }
  return null;
}
