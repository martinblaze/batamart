import '../../../core/api/api_client.dart';
import 'order_models.dart';

/// Orders domain (BACKEND_REFERENCE.md §3.6). Deliberately uses
/// `my-orders` (not the legacy `GET /api/orders`) and `confirm-delivery`
/// (never a raw `PATCH .../{id}` to `COMPLETED`) per the doc's explicit
/// "recommended"/"real Confirm Received action" guidance.
class OrdersRepository {
  final _api = ApiClient.instance;

  Future<List<Order>> fetchMyOrders() async {
    final response = await _api.get('/api/orders/my-orders');
    return (response['orders'] as List? ?? const [])
        .whereType<Map>()
        .map((o) => Order.fromJson(o.cast<String, dynamic>()))
        .toList();
  }

  Future<Order> fetchOrder(String id) async {
    // Raw `Order` row, not `{ order: ... }` — but still just a JSON map,
    // so the normal wrapped `get()` (with its ApiException normalization)
    // works fine; no need for raw `.dio.get`.
    final response = await _api.get('/api/orders/$id');
    return Order.fromJson(response);
  }

  /// The real "Confirm Received" action — never PATCH status to COMPLETED
  /// directly, or escrow release/referral reward won't fire (§3.6).
  Future<Order> confirmDelivery(String orderId) async {
    final response = await _api.post(
      '/api/orders/confirm-delivery',
      data: {'orderId': orderId},
    );
    return Order.fromJson(response['order'] as Map<String, dynamic>);
  }

  /// Polling-based (no WebSocket/SSE per §3.6) — call periodically while
  /// the order is in an active delivery state.
  Future<OrderLiveLocation> fetchLiveLocation(String orderId) async {
    final response = await _api.get('/api/orders/$orderId/live-location');
    return OrderLiveLocation.fromJson(response);
  }
}
