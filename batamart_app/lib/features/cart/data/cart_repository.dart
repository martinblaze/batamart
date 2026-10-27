import '../../../core/api/api_client.dart';
import 'cart_models.dart';

/// `POST /api/cart/add` (BACKEND_REFERENCE.md §3.4) is not a persistence
/// call — it re-fetches a live, authoritative snapshot of one product
/// (price/stock cap/seller) to reconcile into local cart state. Call this
/// whenever an item is added, and again right before checkout to catch
/// price/stock drift.
class CartRepository {
  final _api = ApiClient.instance;

  Future<CartItem> reconcile({
    required String productId,
    int quantity = 1,
    String? variantId,
  }) async {
    final response = await _api.post(
      '/api/cart/add',
      data: {
        'productId': productId,
        'quantity': quantity,
        'variantId': ?variantId,
      },
    );
    final item = response['item'] as Map<String, dynamic>;
    return CartItem(
      productId: item['productId'] as String,
      variantId: item['variantId'] as String?,
      quantity: item['quantity'] as int? ?? quantity,
      name: item['name'] as String? ?? '',
      price: (item['price'] as num?)?.toDouble() ?? 0,
      image: item['image'] as String? ?? '',
      sellerId: item['sellerId'] as String? ?? '',
      sellerName: item['sellerName'] as String? ?? '',
      maxQuantity: item['maxQuantity'] as int? ?? quantity,
    );
  }

  /// `POST /api/delivery/quote` (BACKEND_REFERENCE.md §3.5) — zones are
  /// derived server-side from each item's product/seller landmark and the
  /// caller's own profile landmark; only `productId` per item is sent.
  Future<({double fee, int sellerCount, List<DateTime> dates})> quoteDelivery(
    List<CartItem> items,
  ) async {
    final response = await _api.post(
      '/api/delivery/quote',
      data: {
        'cartItems': items
            .map((item) => {'productId': item.productId})
            .toList(),
      },
    );
    return (
      fee: (response['deliveryFee'] as num?)?.toDouble() ?? 0,
      sellerCount: response['sellerCount'] as int? ?? 1,
      dates: (response['deliveryDates'] as List? ?? const [])
          .map((d) => DateTime.tryParse('$d'))
          .whereType<DateTime>()
          .toList(),
    );
  }
}
