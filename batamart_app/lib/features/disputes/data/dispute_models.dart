/// `Dispute.status` enum (BACKEND_REFERENCE.md §2). `resolution` doubles
/// as an internal state-machine sentinel during the return flow — see
/// [DisputeReturnStage].
const kDisputeStatuses = [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED_BUYER_FAVOR',
  'RESOLVED_SELLER_FAVOR',
  'RESOLVED_COMPROMISE',
  'DISMISSED',
];

/// `Dispute.resolution` sentinel values set by the rider's return-pickup
/// flow (Phase 10), read here to show the buyer/seller a human-readable
/// return-tracking stage (BACKEND_REFERENCE.md §5.7):
/// `__AWAITING_PICKUP__` → `__RETURN_PICKED_UP__` → `__RETURN_ON_THE_WAY__`
/// → `__RETURN_DELIVERED_TO_SELLER__` (the last one is the seller's cue to
/// call `confirm-return`).
String? describeReturnStage(String? resolution) {
  switch (resolution) {
    case '__AWAITING_PICKUP__':
      return 'Awaiting rider pickup of the returned item';
    case '__RETURN_PICKED_UP__':
      return 'Rider has picked up the returned item';
    case '__RETURN_ON_THE_WAY__':
      return 'Return is on its way to the seller';
    case '__RETURN_DELIVERED_TO_SELLER__':
      return 'Return delivered — awaiting seller confirmation';
    default:
      return null;
  }
}

class Dispute {
  const Dispute({
    required this.id,
    required this.orderId,
    required this.status,
    required this.reason,
    this.description,
    this.resolution,
    this.buyerEvidence = const [],
    this.buyerId,
    this.sellerId,
    this.productName,
    this.productImage,
    this.orderNumber,
    this.createdAt,
  });

  final String id;
  final String orderId;
  final String status;
  final String reason;
  final String? description;
  final String? resolution;
  final List<String> buyerEvidence;
  final String? buyerId;
  final String? sellerId;
  final String? productName;
  final String? productImage;
  final String? orderNumber;
  final DateTime? createdAt;

  bool get isTerminal => status != 'OPEN' && status != 'UNDER_REVIEW';

  factory Dispute.fromJson(Map<String, dynamic> json) {
    final order = json['order'] as Map<String, dynamic>?;
    final product = order?['product'] as Map<String, dynamic>?;
    final images = (product?['images'] as List?)
        ?.map((e) => e.toString())
        .toList();

    return Dispute(
      id: json['id'] as String,
      orderId: json['orderId'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN',
      reason: json['reason'] as String? ?? '',
      description: json['description'] as String?,
      resolution: json['resolution'] as String?,
      buyerEvidence:
          (json['buyerEvidence'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      buyerId: json['buyerId'] as String?,
      sellerId: json['sellerId'] as String?,
      productName: product?['name'] as String?,
      productImage: (images?.isNotEmpty ?? false) ? images!.first : null,
      orderNumber: order?['orderNumber'] as String?,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.tryParse(json['createdAt'].toString()),
    );
  }
}

class DisputeMessage {
  const DisputeMessage({
    required this.id,
    required this.senderType,
    required this.message,
    this.attachments = const [],
    this.createdAt,
  });

  final String id;
  final String senderType;
  final String message;
  final List<String> attachments;
  final DateTime? createdAt;

  bool get isMine => senderType == 'BUYER';

  factory DisputeMessage.fromJson(Map<String, dynamic> json) {
    return DisputeMessage(
      id: json['id'] as String? ?? '',
      senderType: json['senderType'] as String? ?? 'BUYER',
      message: json['message'] as String? ?? '',
      attachments:
          (json['attachments'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.tryParse(json['createdAt'].toString()),
    );
  }
}
