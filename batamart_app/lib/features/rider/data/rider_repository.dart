import '../../../core/api/api_client.dart';
import '../../orders/data/order_models.dart';
import 'rider_hub_models.dart';
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

  /// By individual `orderId`. Only dispute-return legs can still be advanced
  /// by the rider; for normal orders the server answers 403 because the vendor
  /// marks "picked up" and the buyer marks "delivered".
  Future<void> updateOrderStatus(String orderId, String status) {
    return _api.post(
      '/api/riders/update-status',
      data: {'orderId': orderId, 'status': status},
    );
  }

  /// The product wasn't ready when the rider arrived: the order is released and
  /// rolls over to the next delivery day.
  Future<void> reportNotReady(String orderId) {
    return _api.post(
      '/api/riders/pickups/not-ready',
      data: {'orderId': orderId},
    );
  }

  Future<PickupsResult> fetchPickups() async {
    final response = await _api.get('/api/riders/pickups');
    List<PickupGroup> groups(String key) => (response[key] as List? ?? const [])
        .whereType<Map>()
        .map((g) => PickupGroup.fromJson(g.cast<String, dynamic>()))
        .toList();
    return PickupsResult(available: groups('available'), mine: groups('mine'));
  }

  /// Claims specific orders (a whole area at once).
  Future<int> claimPickups(List<String> orderIds) async {
    final res = await _api.post(
      '/api/riders/claim-pickups',
      data: {'orderIds': orderIds},
    );
    return (res['claimed'] as num?)?.toInt() ?? 0;
  }

  Future<DeliveriesResult> fetchDeliveries() async {
    final response = await _api.get('/api/riders/deliveries');
    final bags = (response['bags'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (b) => PackedBag(
            name: b['bag'] as String? ?? 'Bag',
            count: (b['count'] as num?)?.toInt() ?? 0,
            earn: (b['earn'] as num?)?.toInt() ?? 0,
            orderIds: (b['orderIds'] as List? ?? const [])
                .map((e) => '$e')
                .toList(),
          ),
        )
        .toList();
    final mine = (response['mine'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (g) => DeliveryGroup(
            area: g['area'] as String? ?? 'Other',
            orders: (g['orders'] as List? ?? const [])
                .whereType<Map>()
                .map((o) => DeliveryOrder.fromJson(o.cast<String, dynamic>()))
                .toList(),
          ),
        )
        .toList();
    return DeliveriesResult(bags: bags, mine: mine);
  }

  Future<int> takeBag(List<String> orderIds) async {
    final res = await _api.post(
      '/api/riders/take-bag',
      data: {'orderIds': orderIds},
    );
    return (res['taken'] as num?)?.toInt() ?? 0;
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

  /// Returns how many active orders the server attached this ping to; 0 means
  /// the rider has nothing left to track.
  Future<int> sendLiveLocation({
    String? batchId,
    List<String>? orderIds,
    required double lat,
    required double lng,
    double? accuracy,
    double? heading,
    double? speed,
  }) async {
    final res = await _api.post(
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
    return (res['written'] as num?)?.toInt() ?? 0;
  }
}
