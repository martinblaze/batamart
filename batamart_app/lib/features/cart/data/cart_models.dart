/// Client-local cart line item. There is no server-side cart CRUD API
/// (BACKEND_REFERENCE.md §3.4) — this is the entire persistence model,
/// stored in Hive. `price`/`name`/`image`/`sellerId`/`sellerName`/
/// `maxQuantity` come from `POST /api/cart/add`'s authoritative snapshot,
/// re-fetched whenever an item is added (BACKEND_REFERENCE.md §3.4).
class CartItem {
  const CartItem({
    required this.productId,
    this.variantId,
    required this.quantity,
    required this.name,
    required this.price,
    required this.image,
    required this.sellerId,
    required this.sellerName,
    required this.maxQuantity,
    this.orderNote = '',
    this.buyerDeliveryAcknowledged = false,
  });

  final String productId;
  final String? variantId;
  final int quantity;
  final String name;
  final double price;
  final String image;
  final String sellerId;
  final String sellerName;
  final int maxQuantity;
  final String orderNote;
  final bool buyerDeliveryAcknowledged;

  double get lineTotal => price * quantity;

  CartItem copyWith({
    int? quantity,
    String? orderNote,
    bool? buyerDeliveryAcknowledged,
  }) {
    return CartItem(
      productId: productId,
      variantId: variantId,
      quantity: quantity ?? this.quantity,
      name: name,
      price: price,
      image: image,
      sellerId: sellerId,
      sellerName: sellerName,
      maxQuantity: maxQuantity,
      orderNote: orderNote ?? this.orderNote,
      buyerDeliveryAcknowledged:
          buyerDeliveryAcknowledged ?? this.buyerDeliveryAcknowledged,
    );
  }

  Map<String, dynamic> toJson() => {
    'productId': productId,
    'variantId': variantId,
    'quantity': quantity,
    'name': name,
    'price': price,
    'image': image,
    'sellerId': sellerId,
    'sellerName': sellerName,
    'maxQuantity': maxQuantity,
    'orderNote': orderNote,
    'buyerDeliveryAcknowledged': buyerDeliveryAcknowledged,
  };

  factory CartItem.fromJson(Map<dynamic, dynamic> json) {
    return CartItem(
      productId: json['productId'] as String,
      variantId: json['variantId'] as String?,
      quantity: json['quantity'] as int? ?? 1,
      name: json['name'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      image: json['image'] as String? ?? '',
      sellerId: json['sellerId'] as String? ?? '',
      sellerName: json['sellerName'] as String? ?? '',
      maxQuantity: json['maxQuantity'] as int? ?? 1,
      orderNote: json['orderNote'] as String? ?? '',
      buyerDeliveryAcknowledged:
          json['buyerDeliveryAcknowledged'] as bool? ?? false,
    );
  }
}
