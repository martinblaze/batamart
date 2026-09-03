/// Raw `Notification` row (BACKEND_REFERENCE.md §3.10). `type` + the
/// entity ids directly on the row (order/dispute/product id) drive
/// client-side deep-link routing — see `notification_router.dart`.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.message,
    required this.isRead,
    this.createdAt,
    this.orderId,
    this.disputeId,
    this.productId,
  });

  final String id;
  final String type;
  final String message;
  final bool isRead;
  final DateTime? createdAt;
  final String? orderId;
  final String? disputeId;
  final String? productId;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      message: json['message'] as String? ?? json['title'] as String? ?? '',
      isRead: json['isRead'] as bool? ?? json['read'] as bool? ?? false,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.tryParse(json['createdAt'].toString()),
      orderId: json['orderId'] as String?,
      disputeId: json['disputeId'] as String?,
      productId: json['productId'] as String?,
    );
  }
}
