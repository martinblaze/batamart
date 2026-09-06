import '../../../core/api/api_client.dart';
import '../../marketplace/data/product_models.dart';

import 'category_attribute.dart';

class MyProductsResult {
  const MyProductsResult({
    required this.products,
    required this.total,
    required this.active,
    required this.outOfStock,
    required this.inactive,
  });

  final List<Product> products;
  final int total;
  final int active;
  final int outOfStock;
  final int inactive;
}

/// Seller-side product management (BACKEND_REFERENCE.md §3.3). Note:
/// `POST /api/products` has **no server-side seller-role check** — any
/// authenticated user with a `universityId` can list a product; the
/// buyer/seller UI split is a client convention, not a server gate.
class SellerProductsRepository {
  final _api = ApiClient.instance;

  Future<MyProductsResult> fetchMyProducts() async {
    final response = await _api.get('/api/products/my-products');
    final stats = response['stats'] as Map<String, dynamic>? ?? const {};
    return MyProductsResult(
      products: (response['products'] as List? ?? const [])
          .whereType<Map>()
          .map((p) => Product.fromJson(p.cast<String, dynamic>()))
          .toList(),
      total: stats['total'] as int? ?? 0,
      active: stats['active'] as int? ?? 0,
      outOfStock: stats['outOfStock'] as int? ?? 0,
      inactive: stats['inactive'] as int? ?? 0,
    );
  }

  Future<Product> createProduct({
    required String name,
    required double price,
    required String category,
    required int quantity,
    String? categoryKey,
    String? description,
    String? subcategory,
    String? subcategoryKey,
    List<String> images = const [],
    String? hostelName,
    String? roomNumber,
    String? landmark,
    String? deliveryEstimate,
    String? campaignTag,
    List<Map<String, dynamic>>? variants,
    List<Map<String, dynamic>>? attributes,
    double? estimatedWeightKg,
    Map<String, double>? dimensionsCm,
  }) async {
    final response = await _api.post(
      '/api/products',
      data: {
        'name': name,
        'price': price,
        'category': category,
        'categoryKey': ?categoryKey,
        'quantity': quantity,
        // Required literal `true` — the delivery-suitability confirmation
        // the seller ticks in step 3 of the Sell flow (§3.3).
        'productDeliveryAgreement': true,
        'description': ?description,
        'subcategory': ?subcategory,
        'subcategoryKey': ?subcategoryKey,
        if (images.isNotEmpty) 'images': images,
        'hostelName': ?hostelName,
        'roomNumber': ?roomNumber,
        'landmark': ?landmark,
        'deliveryEstimate': ?deliveryEstimate,
        'campaignTag': ?campaignTag,
        if (variants != null && variants.isNotEmpty) 'variants': variants,
        // Structured Category Details. `POST /api/products` normalizes each
        // entry to {key,label,value,searchable,filterable} and stores them as
        // ProductAttributeValue rows, which is what makes a listing turn up
        // under the search filters for its category.
        if (attributes != null && attributes.isNotEmpty) 'attributes': attributes,
        'estimatedWeightKg': ?estimatedWeightKg,
        'dimensionsCm': ?dimensionsCm,
      },
    );
    return Product.fromJson(response['product'] as Map<String, dynamic>);
  }

  /// Pause/activate — `PUT /api/products/{id}` with just `isActive`.
  Future<void> setActive(String productId, bool isActive) {
    return _api.put('/api/products/$productId', data: {'isActive': isActive});
  }

  /// Adds [quantity] to existing stock and force-reactivates the listing
  /// (§3.3 — not a reset, and touches `isActive` regardless of prior state).
  Future<Product> restock(String productId, int quantity) async {
    final response = await _api.post(
      '/api/products/$productId/restock',
      data: {'quantity': quantity},
    );
    return Product.fromJson(response['product'] as Map<String, dynamic>);
  }

  Future<void> deleteProduct(String productId) {
    return _api.delete('/api/products/$productId');
  }

  /// `GET /api/category-attributes` — the structured fields for a category,
  /// with their options already hydrated server-side.
  ///
  /// Returns an empty list rather than throwing when the category has no
  /// attributes configured: a category with no details is a normal state, and
  /// the sell flow must stay usable for it.
  Future<List<CategoryAttributeDef>> fetchCategoryAttributes({
    required String categoryKey,
    String? subcategoryKey,
  }) async {
    final response = await _api.get(
      '/api/category-attributes',
      queryParameters: {
        'categoryKey': categoryKey,
        'subcategoryKey': ?subcategoryKey,
      },
    );
    return (response['attributes'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => CategoryAttributeDef.fromJson(e.cast<String, dynamic>()))
        .where((a) => a.key.isNotEmpty)
        .toList();
  }
}
