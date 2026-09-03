import '../../../core/api/api_client.dart';
import '../../orders/data/order_models.dart';
import 'rider_models.dart';

/// The exact string `POST /api/riders/decline-oversized` requires for
/// `reason` (BACKEND_REFERENCE.md §3.12) — any other value 400s.
const kOversizedDeclineReason = 'Item Too Large For Motorcycle Delivery';

/// Riders domain (BACKEND_REFERENCE.md §3.12). Every route here does its
/// own `role !== 'RIDER'` gate server-side — this is what actually walls
/// riders off, not client-side routing.
class RiderRepository {
  final _api = ApiClient.instance;

  Future<AvailableOrdersResult> fetchAvailableOrders() async {
    final response = await _api.get('/api/riders/available-orders');
    return AvailableOrdersResult(
      batches: (response['batches'] as List? ?? const [])
          .whereType<Map>()
          .map((b) => DeliveryBatch.fromJson(b.cast<String, dynamic>()))
          .toList(),
      disputePickups: (response['disputePickups'] as List? ?? const [])
          .whereType<Map>()
          .map((o) => Order.fromJson(o.cast<String, dynamic>()))
          .toList(),
    );
  }

  /// Claims by `batchId`, not `orderId`. Throws [ApiException] with
  /// `body['blockReason']` set to one of `DISPUTE_PICKUP_PENDING`,
  /// `ACTIVE_DELIVERY`, `AWAITING_SELLER_ACCEPTANCE`,
  /// `CAMPAIGN_DELIVERY_NOT_STARTED` for UI branching (§3.12).
  Future<void> acceptBatch(String batchId) {
    return _api.post('/api/riders/accept-order', data: {'batchId': batchId});
  }

  Future<List<DeliveryBatch>> fetchMyDeliveries() async {
    final response = await _api.get('/api/riders/my-deliveries');
    return (response['batches'] as List? ?? const [])
        .whereType<Map>()
        .map((b) => DeliveryBatch.fromJson(b.cast<String, dynamic>()))
        .toList();
  }

  /// By individual `orderId`, not `batchId` — called once per leg
  /// (§3.12). Enforced transitions only: RIDER_ASSIGNED→PICKED_UP→
  /// ON_THE_WAY→DELIVERED.
  Future<void> updateOrderStatus(String orderId, String status) {
    return _api.post(
      '/api/riders/update-status',
      data: {'orderId': orderId, 'status': status},
    );
  }

  Future<bool> toggleAvailability() async {
    final response = await _api.post('/api/riders/toggle-availability');
    return response['isAvailable'] as bool? ?? false;
  }

  Future<void> declineOversized(String orderId, {String? proofImageUrl}) {
    return _api.post(
      '/api/riders/decline-oversized',
      data: {
        'orderId': orderId,
        'reason': kOversizedDeclineReason,
        'proofImageUrl': ?proofImageUrl,
      },
    );
  }

  /// Marks the *return-item pickup* leg complete for a dispute-refund job
  /// — despite the route name, not "disputing a pickup" (§3.12).
  Future<void> confirmDisputePickedUp(String orderId) {
    return _api.post(
      '/api/riders/dispute-picked-up',
      data: {'orderId': orderId},
    );
  }

  Future<void> sendLiveLocation({
    String? batchId,
    List<String>? orderIds,
    required double lat,
    required double lng,
    double? accuracy,
    double? heading,
    double? speed,
  }) {
    return _api.post(
      '/api/riders/live-location',
      data: {
        'orderIds': ?orderIds,
        'batchId': ?batchId,
        'lat': lat,
        'lng': lng,
        'accuracy': ?accuracy,
        'heading': ?heading,
        'speed': ?speed,
      },
    );
  }
}
