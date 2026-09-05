/// Photography for each top-level category.
///
/// The category row used to be twelve tinted circles with a line icon in each,
/// which is the single clearest tell of a generated UI: every category looks
/// identical, so the row carries no information until you read the labels.
/// A photograph tells you what "Beauty & Health" contains before you read the
/// word — and it is what makes a browse surface feel like a shop.
///
/// Keys are the `ProductCategory.key` values in `category_tree.dart`. Every
/// top-level key has an entry; [categoryImage] falls back to null for the
/// sub-category keys, whose callers render the icon treatment instead.
const categoryImages = <String, String>{
  'electronics': 'assets/images/cat-electronics.webp',
  'computing': 'assets/images/cat-computing.webp',
  'fashion': 'assets/images/cat-fashion.webp',
  'home_kitchen': 'assets/images/cat-home.webp',
  'groceries': 'assets/images/cat-groceries.webp',
  'beauty': 'assets/images/cat-beauty.webp',
  'sports': 'assets/images/cat-sports.webp',
  'vehicles': 'assets/images/cat-vehicles.webp',
  'books': 'assets/images/cat-books.webp',
  'tickets': 'assets/images/cat-events.webp',
  'kids': 'assets/images/cat-kids.webp',
  'arts_crafts': 'assets/images/cat-arts.webp',
};

/// Asset path for [categoryKey], or null when the key has no photograph
/// (sub-categories, or a key added to the tree without a matching image).
String? categoryImage(String categoryKey) => categoryImages[categoryKey];
