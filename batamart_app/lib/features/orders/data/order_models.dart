/// Covers both `GET /api/orders/my-orders`'s slimmer per-order shape and
/// `GET /api/orders/{id}`'s raw full `Order` row (BACKEND_REFERENCE.md
/// §3.6) — fields present in one but not the other are simply null/
/// defaulted from whichever response actually supplied them.
///
/// `quantity` is not explicitly listed in my-orders' documented response
/// shape (only present on the full `Order` row per §2) — parsed
/// defensively here and defaulted to 1 if absent; verify against live
/// data once reachable.
class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.totalAmount,
    this.deliveryFee = 0,
    this.quantity = 1,
    required this.status,
    this.createdAt,
    this.deliveredAt,
    this.pickedUpAt,
    this.completedAt,
    this.orderNote,
    this.canDispute = false,
    this.hasExistingDispute = false,
    this.existingDisputeStatus,
    this.productName,
    this.productImages = const [],
    this.productId,
    this.sellerId,
    this.sellerName,
    this.sellerRating = 0,
    this.sellerTrustLevel = 'BRONZE',
    this.riderId,
    this.riderName,
    this.riderPhone,
    this.riderProfilePhoto,
    this.deliveryHostel,
    this.deliveryRoom,
    this.deliveryLandmark,
    this.deliveryPhone,
    this.hasProductReview = false,
    this.hasSellerReview = false,
    this.buyerId,
    this.buyerName,
    this.buyerPhoto,
    this.disputeId,
  });

  final String id;
  final String orderNumber;
  final double totalAmount;
  final double deliveryFee;
  final int quantity;
  final String status;
  final DateTime? createdAt;
  final DateTime? deliveredAt;
  final DateTime? pickedUpAt;
  final DateTime? completedAt;
  final String? orderNote;
  final bool canDispute;
  final bool hasExistingDispute;
  final String? existingDisputeStatus;
  final String? productName;
  final List<String> productImages;
  final String? productId;
  final String? sellerId;
  final String? sellerName;
  final double sellerRating;
  final String sellerTrustLevel;
  final String? riderId;
  final String? riderName;
  final String? riderPhone;
  final String? riderProfilePhoto;
  final String? deliveryHostel;
  final String? deliveryRoom;
  final String? deliveryLandmark;
  final String? deliveryPhone;
  final bool hasProductReview;
  final bool hasSellerReview;
  final String? buyerId;
  final String? buyerName;
  final String? buyerPhoto;
  final String? disputeId;

  String get thumbnail => productImages.isNotEmpty ? productImages.first : '';
  bool get hasRider => riderId != null;

  String get deliveryAddress => [
    deliveryHostel,
    deliveryRoom,
    deliveryLandmark,
  ].where((s) => s != null && s.isNotEmpty).join(', ');

  /// Order Tracking's 4-step stepper (Confirmed/Processing/On the way/
  /// Delivered) — maps every `OrderStatus` value onto one of those 4
  /// positions since the mockup only shows 4 steps.
  int get trackingStepIndex {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'PROCESSING':
      case 'RIDER_ASSIGNED':
        return 1;
      case 'PICKED_UP':
      case 'AT_HUB':
      case 'PACKED':
      case 'ON_THE_WAY':
        return 2;
      case 'DELIVERED':
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  }

  bool get isActiveDelivery =>
      status == 'RIDER_ASSIGNED' ||
      status == 'PICKED_UP' ||
      status == 'ON_THE_WAY';

  factory Order.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>?;
    final seller = json['seller'] as Map<String, dynamic>?;
    final rider = json['rider'] as Map<String, dynamic>?;
    final buyer = json['buyer'] as Map<String, dynamic>?;
    final productReviews = json['productReviews'] as List?;
    final reviews = json['reviews'] as List?;

    DateTime? parseDate(dynamic v) =>
        v == null ? null : DateTime.tryParse(v.toString());

    return Order(
      id: json['id'] as String,
      orderNumber: json['orderNumber'] as String? ?? '',
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0,
      quantity: json['quantity'] as int? ?? 1,
      status: json['status'] as String? ?? 'PENDING',
      createdAt: parseDate(json['createdAt'] ?? json['orderedAt']),
      deliveredAt: parseDate(json['deliveredAt']),
      pickedUpAt: parseDate(json['pickedUpAt']),
      completedAt: parseDate(json['completedAt']),
      orderNote: json['orderNote'] as String?,
      canDispute: json['canDispute'] as bool? ?? false,
      hasExistingDispute: json['hasExistingDispute'] as bool? ?? false,
      existingDisputeStatus: json['existingDisputeStatus'] as String?,
      productName:
          product?['name'] as String? ?? json['productName'] as String?,
      productImages:
          (product?['images'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      productId: json['productId'] as String? ?? product?['id'] as String?,
      sellerId: json['sellerId'] as String? ?? seller?['id'] as String?,
      sellerName: seller?['name'] as String?,
      sellerRating:
          (seller?['rating'] as num?)?.toDouble() ??
          (seller?['avgRating'] as num?)?.toDouble() ??
          0,
      sellerTrustLevel: seller?['trustLevel'] as String? ?? 'BRONZE',
      riderId: json['riderId'] as String? ?? rider?['id'] as String?,
      riderName: rider?['name'] as String?,
      riderPhone: rider?['phone'] as String?,
      riderProfilePhoto: rider?['profilePhoto'] as String?,
      deliveryHostel: json['deliveryHostel'] as String?,
      deliveryRoom: json['deliveryRoom'] as String?,
      deliveryLandmark: json['deliveryLandmark'] as String?,
      deliveryPhone: json['deliveryPhone'] as String?,
      hasProductReview: (productReviews?.isNotEmpty) ?? false,
      hasSellerReview: (reviews?.isNotEmpty) ?? false,
      buyerId: json['buyerId'] as String? ?? buyer?['id'] as String?,
      buyerName: buyer?['name'] as String?,
      buyerPhoto: buyer?['profilePhoto'] as String?,
      disputeId: (json['dispute'] as Map?)?['id'] as String?,
    );
  }
}

class LiveLocationPoint {
  const LiveLocationPoint({required this.lat, required this.lng, this.at});

  final double lat;
  final double lng;
  final DateTime? at;

  factory LiveLocationPoint.fromJson(Map<String, dynamic> json) {
    return LiveLocationPoint(
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      at: json['at'] == null ? null : DateTime.tryParse(json['at'].toString()),
    );
  }
}

class OrderLiveLocation {
  const OrderLiveLocation({this.riderName, this.latestPoint, this.updatedAt});

  final String? riderName;
  final LiveLocationPoint? latestPoint;
  final DateTime? updatedAt;

  factory OrderLiveLocation.fromJson(Map<String, dynamic> json) {
    final rider = json['rider'] as Map<String, dynamic>?;
    final latest = json['latestPoint'] as Map<String, dynamic>?;
    return OrderLiveLocation(
      riderName: rider?['name'] as String?,
      latestPoint: latest == null ? null : LiveLocationPoint.fromJson(latest),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.tryParse(json['updatedAt'].toString()),
    );
  }
}
