import '../../../core/api/api_client.dart';
import '../../orders/data/order_models.dart';

/// Seller's incoming orders (BACKEND_REFERENCE.md §3.6). Uses `sales`
/// (the doc's suggested newer/variant-aware route) rather than the
/// near-duplicate `seller-orders`.
class SellerOrdersRepository {
  final _api = ApiClient.instance;

  Future<List<Order>> fetchSales() async {
    final response = await _api.get('/api/orders/sales');
    return (response['orders'] as List? ?? const [])
        .whereType<Map>()
        .map((o) => Order.fromJson(o.cast<String, dynamic>()))
        .toList();
  }

  /// The vendor confirms they gave the parcel to the rider; riders cannot
  /// mark this themselves (`POST /api/orders/{id}/handover`).
  Future<void> markPickedUp(String orderId) {
    return _api.post('/api/orders/$orderId/handover');
  }

  /// "Accept Order" — the seller's only allowed manual transition
  /// (`PENDING` → `PROCESSING`) via `PATCH /api/orders/{id}` (§3.6).
  Future<void> acceptOrder(String orderId) {
    return _api.patch('/api/orders/$orderId', data: {'status': 'PROCESSING'});
  }
}
