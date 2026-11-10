/// Limits mirrored from `lib/tickets/config.ts`. The server is the authority;
/// these only let the form catch obvious mistakes before a round trip.
const kMaxCommissionPct = 30;
const kMinTicketPrice = 100;
const kMaxTicketPrice = 500000;
const kMaxTiersPerEvent = 10;
const kMaxCheckersPerEvent = 30;
const kMaxUniqueSellersPerEvent = 100;
const kPlatformFeePct = 10;

int _int(dynamic v) {
  if (v is num) return v.round();
  if (v is String) return num.tryParse(v)?.round() ?? 0;
  return 0;
}

DateTime? _date(dynamic v) {
  if (v is String) return DateTime.tryParse(v)?.toLocal();
  return null;
}

String? _str(dynamic v) {
  if (v is String && v.trim().isNotEmpty) return v;
  return null;
}

List<Map<String, dynamic>> _maps(dynamic v) => (v as List? ?? const [])
    .whereType<Map>()
    .map((e) => e.cast<String, dynamic>())
    .toList();

/// Row of `GET /api/tickets/host/events`.
class HostEventSummary {
  const HostEventSummary({
    required this.id,
    required this.name,
    required this.status,
    required this.startsAt,
    required this.ticketsSold,
    required this.capacity,
    required this.revenue,
    this.reviewNote,
  });

  final String id;
  final String name;
  final String status;
  final DateTime? startsAt;
  final int ticketsSold;
  final int capacity;
  final int revenue;
  /// Admin note (`TicketEvent.reviewNote`); the list only sends it when REJECTED.
  final String? reviewNote;

  factory HostEventSummary.fromJson(Map<String, dynamic> j) => HostEventSummary(
    id: '${j['id']}',
    name: j['name'] as String? ?? '',
    status: j['status'] as String? ?? 'PENDING_REVIEW',
    startsAt: _date(j['startsAt']),
    ticketsSold: _int(j['ticketsSold']),
    capacity: _int(j['capacity']),
    revenue: _int(j['revenue']),
    reviewNote: _str(j['reviewNote']),
  );
}

class HostTier {
  const HostTier({
    required this.id,
    required this.name,
    required this.price,
    required this.capacity,
    required this.sold,
    required this.randomCommissionPct,
    required this.uniqueCommissionPct,
    this.isActive = true,
    this.description,
    this.imageUrl,
    this.saleStartsAt,
    this.saleEndsAt,
  });

  final String id;
  final bool isActive;
  final String name;
  final String? description;
  final String? imageUrl;
  final int price;
  final int capacity;
  final int sold;
  final int randomCommissionPct;
  final int uniqueCommissionPct;
  final DateTime? saleStartsAt;
  final DateTime? saleEndsAt;

  int get available => (capacity - sold).clamp(0, capacity);

  factory HostTier.fromJson(Map<String, dynamic> j) => HostTier(
    id: '${j['id']}',
    name: j['name'] as String? ?? '',
    description: _str(j['description']),
    imageUrl: _str(j['imageUrl']),
    price: _int(j['price']),
    capacity: _int(j['capacity']),
    sold: _int(j['sold']),
    isActive: j['isActive'] as bool? ?? true,
    randomCommissionPct: _int(j['randomCommissionPct']),
    uniqueCommissionPct: _int(j['uniqueCommissionPct']),
    saleStartsAt: _date(j['saleStartsAt']),
    saleEndsAt: _date(j['saleEndsAt']),
  );
}

class HostTotals {
  const HostTotals({
    this.ticketsSold = 0,
    this.grossSales = 0,
    this.platformFee = 0,
    this.commissionPaid = 0,
    this.hostEarnings = 0,
    this.checkedIn = 0,
  });

  final int ticketsSold;
  final int grossSales;
  final int platformFee;
  final int commissionPaid;
  final int hostEarnings;
  final int checkedIn;

  factory HostTotals.fromJson(Map<String, dynamic> j) => HostTotals(
    ticketsSold: _int(j['ticketsSold']),
    grossSales: _int(j['grossSales']),
    platformFee: _int(j['platformFee']),
    commissionPaid: _int(j['commissionPaid']),
    hostEarnings: _int(j['hostEarnings']),
    checkedIn: _int(j['checkedIn']),
  );
}

class HostSeller {
  const HostSeller({
    required this.rowId,
    required this.kind,
    required this.userId,
    required this.name,
    required this.username,
    required this.ticketsSold,
    required this.grossSales,
    required this.commission,
  });

  /// The `EventSeller` row id used by `DELETE .../sellers/[rowId]`. Only
  /// present for UNIQUE sellers; null for random resellers.
  final String? rowId;
  final String kind;
  final String? userId;
  final String name;
  final String? username;
  final int ticketsSold;
  final int grossSales;
  final int commission;

  bool get isUnique => kind == 'UNIQUE';

  factory HostSeller.fromJson(Map<String, dynamic> j) => HostSeller(
    rowId: _str(j['rowId']),
    kind: j['kind'] as String? ?? 'RANDOM',
    userId: _str(j['userId']),
    name: j['name'] as String? ?? '',
    username: _str(j['username']),
    ticketsSold: _int(j['ticketsSold']),
    grossSales: _int(j['grossSales']),
    commission: _int(j['commission']),
  );
}

class HostChecker {
  const HostChecker({
    required this.id,
    required this.email,
    required this.name,
    required this.isActive,
    required this.lastLoginAt,
    required this.scanCount,
    required this.okCount,
  });

  final String id;
  final String email;
  final String? name;
  final bool isActive;
  final DateTime? lastLoginAt;
  final int scanCount;
  final int okCount;

  factory HostChecker.fromJson(Map<String, dynamic> j) => HostChecker(
    id: '${j['id']}',
    email: j['email'] as String? ?? '',
    name: _str(j['name']),
    isActive: j['isActive'] as bool? ?? true,
    lastLoginAt: _date(j['lastLoginAt']),
    scanCount: _int(j['scanCount']),
    okCount: _int(j['okCount']),
  );
}

class HostPurchase {
  const HostPurchase({
    required this.id,
    required this.createdAt,
    required this.buyerLabel,
    required this.via,
    required this.kind,
    required this.tierName,
    required this.quantity,
    required this.amount,
  });

  final String id;
  final DateTime? createdAt;
  final String buyerLabel;
  final String via;
  final String kind;
  final String tierName;
  final int quantity;
  final int amount;

  factory HostPurchase.fromJson(Map<String, dynamic> j) => HostPurchase(
    id: '${j['id']}',
    createdAt: _date(j['createdAt']),
    buyerLabel: j['buyerLabel'] as String? ?? '',
    via: j['via'] as String? ?? 'DIRECT',
    kind: j['kind'] as String? ?? 'DIRECT',
    tierName: j['tierName'] as String? ?? '',
    quantity: _int(j['quantity']),
    amount: _int(j['amount']),
  );
}

class HostEventDetail {
  const HostEventDetail({
    required this.id,
    required this.name,
    required this.description,
    required this.venue,
    required this.address,
    required this.startsAt,
    required this.endsAt,
    required this.flyerUrl,
    required this.status,
    required this.allowResale,
    required this.reviewNote,
    this.pendingFlyerUrl,
    this.pendingDescription,
    required this.tiers,
    required this.totals,
    required this.sellers,
    required this.checkers,
    required this.purchases,
    required this.scans,
  });

  final String id;
  final String name;
  final String description;
  final String venue;
  final String address;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String? flyerUrl;
  final String status;
  final bool allowResale;
  final String? reviewNote;

  /// New flyer/description waiting for admin approval (the live ones above keep showing publicly).
  /// [pendingDescription] is null when no description change is pending, '' when it is being cleared.
  final String? pendingFlyerUrl;
  final String? pendingDescription;
  bool get hasPendingChange => pendingFlyerUrl != null || pendingDescription != null;

  /// What the host last asked for: the pending description if there is one, else the live one.
  String get effectiveDescription => pendingDescription ?? description;
  final List<HostTier> tiers;
  final HostTotals totals;
  final List<HostSeller> sellers;
  final List<HostChecker> checkers;
  final List<HostPurchase> purchases;

  /// Raw scan rows when the dashboard includes them (otherwise the Activity
  /// tab reads scans from the audit timeline).
  final List<AuditEntry> scans;

  bool get isCancelled => status == 'CANCELLED';
  bool get canCancel => status == 'ACTIVE' || status == 'PAUSED';

  factory HostEventDetail.fromJson(Map<String, dynamic> json) {
    final e = (json['event'] as Map?)?.cast<String, dynamic>() ?? const {};
    return HostEventDetail(
      id: '${e['id']}',
      name: e['name'] as String? ?? '',
      description: e['description'] as String? ?? '',
      venue: e['venue'] as String? ?? '',
      address: e['address'] as String? ?? '',
      startsAt: _date(e['startsAt']),
      endsAt: _date(e['endsAt']),
      flyerUrl: _str(e['flyerUrl']),
      status: e['status'] as String? ?? 'PENDING_REVIEW',
      allowResale: e['allowResale'] as bool? ?? false,
      reviewNote: _str(e['reviewNote']),
      pendingFlyerUrl: _str((e['pendingChange'] as Map?)?['flyerUrl']),
      pendingDescription: (e['pendingChange'] as Map?)?['description'] as String?,
      tiers: _maps(json['tiers']).map(HostTier.fromJson).toList(),
      totals: HostTotals.fromJson(
        (json['totals'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      sellers: _maps(json['sellers']).map(HostSeller.fromJson).toList(),
      checkers: _maps(json['checkers']).map(HostChecker.fromJson).toList(),
      purchases: _maps(json['purchases']).map(HostPurchase.fromJson).toList(),
      scans: _maps(json['scans']).map(AuditEntry.fromScan).toList(),
    );
  }
}

/// One line of the merged audit timeline (purchase, transfer, scan, status).
class AuditEntry {
  const AuditEntry({
    required this.at,
    required this.type,
    required this.message,
    this.result,
  });

  final DateTime? at;
  final String type;
  final String message;
  final String? result;

  bool get isScan => type.toUpperCase().contains('SCAN');

  /// Audit timeline item: `{ at, type: PURCHASE|TRANSFER|SCAN|CHANGE, text }`.
  factory AuditEntry.fromJson(Map<String, dynamic> j) => AuditEntry(
    at: _date(j['at']),
    type: j['type'] as String? ?? 'CHANGE',
    message: _str(j['text']) ?? '',
  );

  /// Dashboard scan row: `{ id, result, holder, tierName, createdAt, checker }`.
  factory AuditEntry.fromScan(Map<String, dynamic> j) {
    final result = _str(j['result']) ?? 'SCAN';
    final holder = _str(j['holder']);
    final tier = _str(j['tierName']);
    final checker = _str(j['checker']);
    return AuditEntry(
      at: _date(j['createdAt']),
      type: 'SCAN',
      message: [
        result.replaceAll('_', ' ').toLowerCase(),
        ?holder,
        if (tier != null) '($tier)',
        if (checker != null) 'by $checker',
      ].join(' '),
      result: result,
    );
  }
}

class AuditPage {
  const AuditPage({required this.entries, required this.nextCursor});
  final List<AuditEntry> entries;
  final String? nextCursor;

  factory AuditPage.fromJson(Map<String, dynamic> j) {
    return AuditPage(
      entries: _maps(j['items']).map(AuditEntry.fromJson).toList(),
      nextCursor: _str(j['nextCursor']),
    );
  }
}

/// Row of `GET /api/tickets/listings/mine`.
class TicketListingItem {
  const TicketListingItem({
    required this.id,
    required this.eventId,
    required this.eventName,
    required this.startsAt,
    required this.isActive,
    required this.kind,
    required this.ticketsSold,
    required this.commissionEarned,
    required this.tiers,
  });

  final String id;
  final String eventId;
  final String eventName;
  final DateTime? startsAt;
  final bool isActive;
  final String kind;
  final int ticketsSold;
  final int commissionEarned;
  final List<ListingTier> tiers;

  bool get isUnique => kind == 'UNIQUE';

  factory TicketListingItem.fromJson(Map<String, dynamic> j) => TicketListingItem(
    id: '${j['id']}',
    eventId: '${j['eventId']}',
    eventName: j['eventName'] as String? ?? '',
    startsAt: _date(j['startsAt']),
    isActive: j['isActive'] as bool? ?? true,
    kind: j['kind'] as String? ?? 'RANDOM',
    ticketsSold: _int(j['ticketsSold']),
    commissionEarned: _int(j['commissionEarned']),
    tiers: _maps(j['tiers']).map(ListingTier.fromJson).toList(),
  );
}

class ListingTier {
  const ListingTier({
    required this.name,
    required this.price,
    required this.commissionPct,
  });
  final String name;
  final int price;
  final int commissionPct;

  factory ListingTier.fromJson(Map<String, dynamic> j) => ListingTier(
    name: j['name'] as String? ?? '',
    price: _int(j['price']),
    commissionPct: _int(j['commissionPct']),
  );
}

/// Tier as typed into the create form, serialised to the POST contract.
class NewTierPayload {
  const NewTierPayload({
    required this.name,
    required this.price,
    required this.capacity,
    required this.randomCommissionPct,
    required this.uniqueCommissionPct,
    this.description,
    this.imageUrl,
    this.saleStartsAt,
    this.saleEndsAt,
  });

  final String name;
  final String? description;
  final String? imageUrl;
  final int price;
  final int capacity;
  final int randomCommissionPct;
  final int uniqueCommissionPct;
  final DateTime? saleStartsAt;
  final DateTime? saleEndsAt;

  Map<String, dynamic> toJson() => {
    'name': name,
    'description': ?description,
    'imageUrl': ?imageUrl,
    'price': price,
    'capacity': capacity,
    'randomCommissionPct': randomCommissionPct,
    'uniqueCommissionPct': uniqueCommissionPct,
    'saleStartsAt': ?saleStartsAt?.toUtc().toIso8601String(),
    'saleEndsAt': ?saleEndsAt?.toUtc().toIso8601String(),
  };
}
