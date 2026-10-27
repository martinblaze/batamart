// Models for the hub flow: the rider's Pickups and Deliveries tabs.

class PickupItem {
  const PickupItem({required this.name, required this.quantity});
  final String name;
  final int quantity;
}

class PickupOrder {
  const PickupOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    this.username,
    this.note,
    required this.earn,
    required this.deliveryDate,
    required this.canTakeNow,
    required this.vendorName,
    this.vendorPhone,
    this.vendorPlace,
    this.items = const [],
  });

  final String id;
  final String orderNumber;
  final String status;
  final String? username;
  final String? note;
  final int earn;
  final DateTime? deliveryDate;
  final bool canTakeNow;
  final String vendorName;
  final String? vendorPhone;
  final String? vendorPlace;
  final List<PickupItem> items;

  factory PickupOrder.fromJson(Map<String, dynamic> json) {
    final vendor =
        (json['vendor'] as Map?)?.cast<String, dynamic>() ?? const {};
    final place = [
      vendor['hostel'],
      if (vendor['room'] != null) 'Room ${vendor['room']}',
      vendor['landmark'],
    ].where((e) => e != null && e.toString().isNotEmpty).join(', ');
    return PickupOrder(
      id: json['id'] as String? ?? '',
      orderNumber: json['orderNumber'] as String? ?? '',
      status: json['status'] as String? ?? '',
      username: json['username'] as String?,
      note: json['note'] as String?,
      earn: (json['earn'] as num?)?.toInt() ?? 0,
      deliveryDate: DateTime.tryParse(json['deliveryDate'] as String? ?? ''),
      canTakeNow: json['canTakeNow'] as bool? ?? false,
      vendorName: vendor['name'] as String? ?? '',
      vendorPhone: vendor['phone'] as String?,
      vendorPlace: place.isEmpty ? null : place,
      items: (json['items'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (i) => PickupItem(
              name: i['name'] as String? ?? '',
              quantity: (i['quantity'] as num?)?.toInt() ?? 1,
            ),
          )
          .toList(),
    );
  }
}

class PickupGroup {
  const PickupGroup({
    required this.area,
    required this.orders,
    required this.claimable,
  });
  final String area;
  final List<PickupOrder> orders;
  final int claimable;

  factory PickupGroup.fromJson(Map<String, dynamic> json) => PickupGroup(
    area: json['area'] as String? ?? 'Other',
    claimable: (json['claimable'] as num?)?.toInt() ?? 0,
    orders: (json['orders'] as List? ?? const [])
        .whereType<Map>()
        .map((o) => PickupOrder.fromJson(o.cast<String, dynamic>()))
        .toList(),
  );
}

class PickupsResult {
  const PickupsResult({required this.available, required this.mine});
  final List<PickupGroup> available;
  final List<PickupGroup> mine;
}

class DeliveryOrder {
  const DeliveryOrder({
    required this.id,
    required this.orderNumber,
    this.username,
    this.buyerName,
    required this.phone,
    required this.address,
    this.note,
    required this.earn,
    this.items = const [],
  });

  final String id;
  final String orderNumber;
  final String? username;
  final String? buyerName;
  final String phone;
  final String address;
  final String? note;
  final int earn;
  final List<String> items;

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) {
    final address = [
      json['hostel'],
      if ((json['room'] ?? '').toString().isNotEmpty) 'Room ${json['room']}',
      json['landmark'],
    ].where((e) => e != null && e.toString().isNotEmpty).join(', ');
    return DeliveryOrder(
      id: json['id'] as String? ?? '',
      orderNumber: json['orderNumber'] as String? ?? '',
      username: json['username'] as String?,
      buyerName: json['buyerName'] as String?,
      phone: json['phone'] as String? ?? '',
      address: address,
      note: json['note'] as String?,
      earn: (json['earn'] as num?)?.toInt() ?? 0,
      items: (json['items'] as List? ?? const []).map((e) => '$e').toList(),
    );
  }
}

class DeliveryGroup {
  const DeliveryGroup({required this.area, required this.orders});
  final String area;
  final List<DeliveryOrder> orders;
}

class PackedBag {
  const PackedBag({
    required this.name,
    required this.count,
    required this.earn,
    required this.orderIds,
  });
  final String name;
  final int count;
  final int earn;
  final List<String> orderIds;
}

class DeliveriesResult {
  const DeliveriesResult({required this.bags, required this.mine});
  final List<PackedBag> bags;
  final List<DeliveryGroup> mine;
}
