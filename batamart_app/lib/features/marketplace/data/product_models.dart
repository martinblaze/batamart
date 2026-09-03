/// Product.seller sub-object as embedded in list/detail responses
/// (BACKEND_REFERENCE.md §3.3). No dedicated "seller profile" endpoint
/// exists — this is the only source for a seller's public stats.
class ProductSeller {
  const ProductSeller({
    required this.id,
    required this.name,
    this.avgRating = 0,
    this.trustLevel = 'BRONZE',
    this.completedOrders = 0,
    this.profilePhoto,
    this.hostelName,
    this.roomNumber,
  });

  final String id;
  final String name;
  final double avgRating;
  final String trustLevel;
  final int completedOrders;
  final String? profilePhoto;
  final String? hostelName;
  final String? roomNumber;

  factory ProductSeller.fromJson(Map<String, dynamic> json) {
    return ProductSeller(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Seller',
      avgRating: (json['avgRating'] as num?)?.toDouble() ?? 0,
      trustLevel: json['trustLevel'] as String? ?? 'BRONZE',
      completedOrders: json['completedOrders'] as int? ?? 0,
      profilePhoto: json['profilePhoto'] as String?,
      hostelName: json['hostelName'] as String?,
      roomNumber: json['roomNumber'] as String?,
    );
  }
}

/// One entry of `Product.variants` (BACKEND_REFERENCE.md §3.3's create-body
/// shape reused for read responses) — `combination` is a free-form
/// key/value map (e.g. `{"size": "42"}`), shape not asserted server-side.
class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.combination,
    required this.price,
    required this.stock,
    this.sku,
    this.imageUrl,
  });

  final String id;
  final Map<String, dynamic> combination;
  final double price;
  final int stock;
  final String? sku;
  final String? imageUrl;

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    return ProductVariant(
      id: json['id'] as String? ?? '',
      combination:
          (json['combination'] as Map?)?.cast<String, dynamic>() ?? const {},
      price: (json['price'] as num?)?.toDouble() ?? 0,
      stock: json['stock'] as int? ?? 0,
      sku: json['sku'] as String?,
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

/// A product as returned by `GET /api/products`, `GET /api/products/{id}`,
/// and `GET /api/products/feed` (BACKEND_REFERENCE.md §3.3). Not every
/// field is present on every response variant — all defaulted/nullable.
class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    this.images = const [],
    this.description,
    this.avgRating = 0,
    this.totalReviews = 0,
    this.category,
    this.categoryKey,
    this.subcategory,
    this.quantity = 0,
    this.isActive = true,
    this.isHot = false,
    this.campaignTag,
    this.deliveryEstimate,
    this.discountPercent,
    this.marketPrice,
    this.variants = const [],
    this.seller,
    this.orderCount = 0,
    this.landmark,
  });

  final String id;
  final String name;
  final double price;
  final List<String> images;
  final String? description;
  final double avgRating;
  final int totalReviews;
  final String? category;
  final String? categoryKey;
  final String? subcategory;
  final int quantity;
  final bool isActive;
  final bool isHot;
  final String? campaignTag;
  final String? deliveryEstimate;
  final int? discountPercent;
  final double? marketPrice;
  final List<ProductVariant> variants;
  final ProductSeller? seller;
  final int orderCount;
  final String? landmark;

  bool get isOutOfStock => quantity <= 0;
  bool get hasDiscount => discountPercent != null && discountPercent! > 0;
  String get thumbnail => images.isNotEmpty ? images.first : '';

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      images:
          (json['images'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      description: json['description'] as String?,
      avgRating: (json['avgRating'] as num?)?.toDouble() ?? 0,
      totalReviews: json['totalReviews'] as int? ?? 0,
      category: json['category'] as String?,
      categoryKey: json['categoryKey'] as String?,
      subcategory: json['subcategory'] as String?,
      quantity: json['quantity'] as int? ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      isHot: json['isHot'] as bool? ?? false,
      campaignTag: json['campaignTag'] as String?,
      deliveryEstimate: json['deliveryEstimate'] as String?,
      discountPercent: json['discountPercent'] as int?,
      marketPrice: (json['marketPrice'] as num?)?.toDouble(),
      variants:
          (json['variants'] as List?)
              ?.whereType<Map>()
              .map((v) => ProductVariant.fromJson(v.cast<String, dynamic>()))
              .toList() ??
          const [],
      seller: json['seller'] is Map<String, dynamic>
          ? ProductSeller.fromJson(json['seller'] as Map<String, dynamic>)
          : null,
      orderCount: (json['_count'] as Map?)?['orders'] as int? ?? 0,
      landmark: json['landmark'] as String?,
    );
  }
}
