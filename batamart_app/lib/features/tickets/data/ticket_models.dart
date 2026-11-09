/// Models for the buyer side of ticketing (docs/TICKETING.md section 5).
/// Parsing is deliberately forgiving: a missing optional field must never
/// blank a whole screen.
DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse('$v')?.toLocal();
int _int(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
Map<String, dynamic> _map(dynamic v) =>
    v is Map ? v.cast<String, dynamic>() : const <String, dynamic>{};

class EventSummary {
  const EventSummary({
    required this.id,
    required this.name,
    required this.venue,
    required this.startsAt,
    required this.flyerUrl,
    required this.fromPrice,
    required this.soldOut,
    required this.hostName,
  });

  final String id;
  final String name;
  final String venue;
  final DateTime? startsAt;
  final String flyerUrl;
  final int? fromPrice;
  final bool soldOut;
  final String hostName;

  factory EventSummary.fromJson(Map<String, dynamic> j) => EventSummary(
    id: '${j['id']}',
    name: j['name'] as String? ?? '',
    venue: j['venue'] as String? ?? '',
    startsAt: _date(j['startsAt']),
    flyerUrl: j['flyerUrl'] as String? ?? '',
    fromPrice: j['fromPrice'] == null ? null : _int(j['fromPrice']),
    soldOut: j['soldOut'] as bool? ?? false,
    hostName: j['hostName'] as String? ?? '',
  );
}

class TicketTierInfo {
  const TicketTierInfo({
    required this.id,
    required this.name,
    required this.description,
    required this.imageUrl,
    required this.price,
    required this.available,
    required this.saleOpen,
    required this.saleMessage,
  });

  final String id;
  final String name;
  final String description;
  final String imageUrl;
  final int price;
  final int available;
  final bool saleOpen;
  final String? saleMessage;

  bool get canBuy => saleOpen && available > 0;

  factory TicketTierInfo.fromJson(Map<String, dynamic> j) => TicketTierInfo(
    id: '${j['id']}',
    name: j['name'] as String? ?? '',
    description: j['description'] as String? ?? '',
    imageUrl: j['imageUrl'] as String? ?? '',
    price: _int(j['price']),
    available: _int(j['available']),
    saleOpen: j['saleOpen'] as bool? ?? true,
    saleMessage: j['saleMessage'] as String?,
  );
}

class EventReseller {
  const EventReseller({required this.id, required this.name, this.username});
  final String id;
  final String name;
  final String? username;

  factory EventReseller.fromJson(Map<String, dynamic> j) => EventReseller(
    id: '${j['id']}',
    name: j['name'] as String? ?? '',
    username: j['username'] as String?,
  );
}

class EventDetail {
  const EventDetail({
    required this.id,
    required this.name,
    required this.description,
    required this.venue,
    required this.address,
    required this.startsAt,
    required this.endsAt,
    required this.flyerUrl,
    required this.hostName,
    required this.hostUsername,
    required this.tiers,
    required this.reseller,
  });

  final String id;
  final String name;
  final String description;
  final String venue;
  final String address;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String flyerUrl;
  final String hostName;
  final String? hostUsername;
  final List<TicketTierInfo> tiers;
  final EventReseller? reseller;

  factory EventDetail.fromJson(Map<String, dynamic> j) {
    final e = _map(j['event']);
    return EventDetail(
      id: '${e['id']}',
      name: e['name'] as String? ?? '',
      description: e['description'] as String? ?? '',
      venue: e['venue'] as String? ?? '',
      address: e['address'] as String? ?? '',
      startsAt: _date(e['startsAt']),
      endsAt: _date(e['endsAt']),
      flyerUrl: e['flyerUrl'] as String? ?? '',
      hostName: e['hostName'] as String? ?? '',
      hostUsername: e['hostUsername'] as String?,
      tiers: (j['tiers'] as List? ?? const [])
          .whereType<Map>()
          .map((t) => TicketTierInfo.fromJson(t.cast<String, dynamic>()))
          .toList(),
      reseller: j['reseller'] is Map
          ? EventReseller.fromJson(_map(j['reseller']))
          : null,
    );
  }
}

class TicketEventRef {
  const TicketEventRef({
    required this.id,
    required this.name,
    required this.venue,
    required this.startsAt,
    required this.flyerUrl,
  });

  final String id;
  final String name;
  final String venue;
  final DateTime? startsAt;
  final String flyerUrl;

  factory TicketEventRef.fromJson(Map<String, dynamic> j) => TicketEventRef(
    id: '${j['id']}',
    name: j['name'] as String? ?? '',
    venue: j['venue'] as String? ?? '',
    startsAt: _date(j['startsAt']),
    flyerUrl: j['flyerUrl'] as String? ?? '',
  );
}

/// A ticket in the "my tickets" list. No secret here by design.
class MyTicket {
  const MyTicket({
    required this.id,
    required this.code,
    required this.status,
    required this.checkedInAt,
    required this.tierName,
    required this.event,
  });

  final String id;
  final String code;
  final String status;
  final DateTime? checkedInAt;
  final String tierName;
  final TicketEventRef event;

  bool get isCheckedIn => status == 'CHECKED_IN';
  bool get isValid => status == 'VALID';

  /// Past = the event is over (start + 12 h when no end is known).
  bool get isPast {
    final s = event.startsAt;
    return s != null && DateTime.now().isAfter(s.add(const Duration(hours: 12)));
  }

  factory MyTicket.fromJson(Map<String, dynamic> j) => MyTicket(
    id: '${j['id']}',
    code: j['code'] as String? ?? '',
    status: j['status'] as String? ?? 'VALID',
    checkedInAt: _date(j['checkedInAt']),
    tierName: j['tierName'] as String? ?? '',
    event: TicketEventRef.fromJson(_map(j['event'])),
  );
}

/// Full ticket with its secret, from GET /api/tickets/ticket/[id].
class TicketDetail {
  const TicketDetail({
    required this.id,
    required this.code,
    required this.status,
    required this.secret,
    required this.secretVersion,
    required this.checkedInAt,
    required this.tierName,
    required this.tierImageUrl,
    required this.event,
    required this.serverTime,
    required this.canTransfer,
  });

  final String id;
  final String code;
  final String status;
  final String secret;
  final int secretVersion;
  final DateTime? checkedInAt;
  final String tierName;
  final String tierImageUrl;
  final TicketEventRef event;
  final int serverTime;

  /// Server decision: owner, VALID, event not cancelled/over.
  final bool canTransfer;

  bool get isCheckedIn => status == 'CHECKED_IN';
  bool get isValid => status == 'VALID';

  /// The API returns the fields flat (also mirrored under `ticket`), with
  /// `serverTime` as epoch milliseconds.
  factory TicketDetail.fromJson(Map<String, dynamic> j) => TicketDetail(
    id: '${j['id']}',
    code: j['code'] as String? ?? '',
    status: j['status'] as String? ?? 'VALID',
    secret: j['secret'] as String? ?? '',
    secretVersion: _int(j['secretVersion']),
    checkedInAt: _date(j['checkedInAt']),
    tierName: j['tierName'] as String? ?? '',
    tierImageUrl: j['tierImageUrl'] as String? ?? '',
    event: TicketEventRef.fromJson(_map(j['event'])),
    canTransfer: j['canTransfer'] as bool? ?? false,
    serverTime: j['serverTime'] is num
        ? (j['serverTime'] as num).toInt()
        : DateTime.now().millisecondsSinceEpoch,
  );
}

class CheckoutResult {
  const CheckoutResult({this.authorizationUrl, this.purchaseId});
  final String? authorizationUrl;
  final String? purchaseId;
}
