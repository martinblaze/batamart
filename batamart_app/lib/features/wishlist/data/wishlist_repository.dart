import '../../../core/api/api_client.dart';

double? _num(dynamic v) =>
    v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);

/// One saved product from `GET /api/wishlist`.
class WishlistItem {
  const WishlistItem({
    required this.productId,
    required this.name,
    required this.price,
    required this.image,
    this.priceWhenSaved,
    this.originalPrice,
    this.discountPercent,
    this.category,
    this.sellerName,
    this.inStock = true,
    this.isActive = true,
    this.priceDropped = false,
    this.dropPercent,
  });

  final String productId;
  final String name;
  final double price;
  final double? priceWhenSaved;
  final double? originalPrice;
  final int? discountPercent;
  final String image;
  final String? category;
  final String? sellerName;
  final bool inStock;
  final bool isActive;
  final bool priceDropped;
  final int? dropPercent;

  bool get unavailable => !inStock || !isActive;

  static WishlistItem? tryParse(dynamic raw) {
    if (raw is! Map) return null;
    final j = raw.cast<String, dynamic>();
    final p = j['product'] is Map
        ? (j['product'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    final id = (j['productId'] ?? p['id'])?.toString();
    final name = p['name']?.toString();
    if (id == null || id.isEmpty || name == null) return null;
    var image = p['image']?.toString() ?? '';
    if (image.isEmpty && p['images'] is List && (p['images'] as List).isNotEmpty) {
      image = (p['images'] as List).first.toString();
    }
    return WishlistItem(
      productId: id,
      name: name,
      price: _num(p['price']) ?? 0,
      priceWhenSaved: _num(j['priceWhenSaved']),
      originalPrice: _num(p['originalPrice']),
      discountPercent: (p['discountPercent'] as num?)?.toInt(),
      image: image,
      category: p['category']?.toString(),
      sellerName: p['sellerName']?.toString(),
      inStock: p['inStock'] as bool? ?? true,
      isActive: p['isActive'] as bool? ?? true,
      priceDropped: p['priceDropped'] as bool? ?? false,
      dropPercent: (p['dropPercent'] as num?)?.toInt(),
    );
  }
}

class WishlistRepository {
  WishlistRepository([ApiClient? api]) : _api = api ?? ApiClient.instance;
  final ApiClient _api;

  Future<List<WishlistItem>> list() async {
    final res = await _api.get('/api/wishlist');
    final items = res['items'];
    if (items is! List) return const [];
    return items.map(WishlistItem.tryParse).whereType<WishlistItem>().toList();
  }

  Future<Set<String>> ids() async {
    final res = await _api.get('/api/wishlist/ids');
    final ids = res['ids'];
    if (ids is! List) return <String>{};
    return ids.map((e) => e.toString()).toSet();
  }

  Future<void> add(String productId) =>
      _api.post('/api/wishlist', data: {'productId': productId});

  Future<void> remove(String productId) =>
      _api.delete('/api/wishlist/$productId');
}
