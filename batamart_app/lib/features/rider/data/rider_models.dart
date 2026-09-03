import '../../orders/data/order_models.dart';

/// A `DeliveryBatch` — one buyer's order can span multiple seller "legs",
/// batched together for one rider to accept/deliver as a unit
/// (BACKEND_REFERENCE.md §3.12). Nested orders reuse the shared [Order]
/// model since their embedded shape (product/seller/buyer) matches.
class DeliveryBatch {
  const DeliveryBatch({
    required this.id,
    this.batchNumber,
    required this.status,
    this.buyerName,
    this.buyerPhone,
    this.orders = const [],
  });

  final String id;
  final String? batchNumber;
  final String status;
  final String? buyerName;
  final String? buyerPhone;
  final List<Order> orders;

  int get orderCount => orders.length;
  double get totalDeliveryFee =>
      orders.fold(0, (sum, o) => sum + o.deliveryFee);

  /// True once every order in the batch is `DELIVERED` — mirrors the
  /// server's own batch-completion rule (§3.12's `update-status` effects).
  bool get isFullyDelivered =>
      orders.isNotEmpty &&
      orders.every((o) => const {'DELIVERED', 'COMPLETED'}.contains(o.status));

  factory DeliveryBatch.fromJson(Map<String, dynamic> json) {
    final buyer = json['buyer'] as Map<String, dynamic>?;
    return DeliveryBatch(
      id: json['id'] as String? ?? '',
      batchNumber: json['batchNumber'] as String?,
      status: json['status'] as String? ?? 'PENDING',
      buyerName: buyer?['name'] as String?,
      buyerPhone: buyer?['phone'] as String?,
      orders: (json['orders'] as List? ?? const [])
          .whereType<Map>()
          .map((o) => Order.fromJson(o.cast<String, dynamic>()))
          .toList(),
    );
  }
}

class AvailableOrdersResult {
  const AvailableOrdersResult({
    required this.batches,
    required this.disputePickups,
  });
  final List<DeliveryBatch> batches;
  final List<Order> disputePickups;
}
