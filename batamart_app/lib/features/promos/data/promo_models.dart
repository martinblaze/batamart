// Parsers for `GET /api/promos/home`. Every field is optional on purpose: the
// backend is built in parallel, and a missing section must degrade to "show
// nothing", never to a crash.

String? _str(dynamic v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

double? _num(dynamic v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

int? _int(dynamic v) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

List<Map<String, dynamic>> _maps(dynamic v) => v is List
    ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
    : const [];

/// One slide of the rotating promo sheet.
class PromoPopup {
  const PromoPopup({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    required this.ctaLabel,
    required this.ctaUrl,
    this.imageUrl,
    this.badge,
  });

  final String id;
  final String kind;
  final String title;
  final String body;
  final String? imageUrl;
  final String ctaLabel;
  final String ctaUrl;
  final String? badge;

  static PromoPopup? tryParse(Map<String, dynamic> j) {
    final title = _str(j['title']);
    final kind = _str(j['kind']);
    if (title == null || kind == null) return null;
    return PromoPopup(
      id: _str(j['id']) ?? '$kind-$title',
      kind: kind,
      title: title,
      body: _str(j['body']) ?? '',
      imageUrl: _str(j['imageUrl']),
      ctaLabel: _str(j['ctaLabel']) ?? 'Take a look',
      ctaUrl: _str(j['ctaUrl']) ?? '/',
      badge: _str(j['badge']),
    );
  }
}

/// `ProductCardLike` from the contract.
class LiveProduct {
  const LiveProduct({
    required this.id,
    required this.name,
    required this.price,
    required this.image,
    this.originalPrice,
    this.discountPercent,
    this.category,
    this.sellerName,
  });

  final String id;
  final String name;
  final double price;
  final double? originalPrice;
  final int? discountPercent;
  final String image;
  final String? category;
  final String? sellerName;

  static LiveProduct? tryParse(Map<String, dynamic> j) {
    final id = _str(j['id']);
    final name = _str(j['name']);
    if (id == null || name == null) return null;
    String image = _str(j['image']) ?? '';
    if (image.isEmpty && j['images'] is List && (j['images'] as List).isNotEmpty) {
      image = (j['images'] as List).first.toString();
    }
    return LiveProduct(
      id: id,
      name: name,
      price: _num(j['price']) ?? 0,
      originalPrice: _num(j['originalPrice']),
      discountPercent: _int(j['discountPercent']),
      image: image,
      category: _str(j['category']),
      sellerName: _str(j['sellerName']),
    );
  }

  static List<LiveProduct> list(dynamic raw) =>
      _maps(raw).map(LiveProduct.tryParse).whereType<LiveProduct>().toList();
}

class LiveDelivery {
  const LiveDelivery({
    required this.label,
    required this.cutoffAt,
    this.nextDeliveryDate,
    this.msLeft,
  });

  final String label;
  final String? nextDeliveryDate;

  /// When ordering closes for that delivery. The countdown ticks locally from
  /// this so it stays correct without polling.
  final DateTime cutoffAt;
  final int? msLeft;

  static LiveDelivery? tryParse(dynamic raw) {
    if (raw is! Map) return null;
    final j = raw.cast<String, dynamic>();
    DateTime? cutoff = DateTime.tryParse(_str(j['cutoffAt']) ?? '');
    final msLeft = _int(j['msLeft']);
    // Fall back to the server's remaining time if the timestamp is unusable.
    if (cutoff == null && msLeft != null) {
      cutoff = DateTime.now().add(Duration(milliseconds: msLeft));
    }
    if (cutoff == null) return null;
    return LiveDelivery(
      label: _str(j['label']) ?? '',
      nextDeliveryDate: _str(j['nextDeliveryDate']),
      cutoffAt: cutoff,
      msLeft: msLeft,
    );
  }
}

class JustOrdered {
  const JustOrdered({
    required this.productName,
    required this.imageUrl,
    required this.minutesAgo,
  });

  final String productName;
  final String? imageUrl;
  final int minutesAgo;

  static JustOrdered? tryParse(Map<String, dynamic> j) {
    final name = _str(j['productName']);
    if (name == null) return null;
    return JustOrdered(
      productName: name,
      imageUrl: _str(j['imageUrl']),
      minutesAgo: _int(j['minutesAgo']) ?? 0,
    );
  }
}

class LiveStats {
  const LiveStats({this.ordersThisWeek, this.activeShoppersToday});
  final int? ordersThisWeek;
  final int? activeShoppersToday;

  bool get isEmpty =>
      (ordersThisWeek ?? 0) <= 0 && (activeShoppersToday ?? 0) <= 0;
}

class LiveHome {
  const LiveHome({
    this.delivery,
    this.trending = const [],
    this.newToday = const [],
    this.priceDrops = const [],
    this.justOrdered = const [],
    this.stats = const LiveStats(),
  });

  final LiveDelivery? delivery;
  final List<LiveProduct> trending;
  final List<LiveProduct> newToday;
  final List<LiveProduct> priceDrops;
  final List<JustOrdered> justOrdered;
  final LiveStats stats;

  factory LiveHome.fromJson(dynamic raw) {
    if (raw is! Map) return const LiveHome();
    final j = raw.cast<String, dynamic>();
    final stats = j['stats'] is Map
        ? (j['stats'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    return LiveHome(
      delivery: LiveDelivery.tryParse(j['delivery']),
      trending: LiveProduct.list(j['trending']),
      newToday: LiveProduct.list(j['newToday']),
      priceDrops: LiveProduct.list(j['priceDrops']),
      justOrdered: _maps(j['justOrdered'])
          .map(JustOrdered.tryParse)
          .whereType<JustOrdered>()
          .toList(),
      stats: LiveStats(
        ordersThisWeek: _int(stats['ordersThisWeek']),
        activeShoppersToday: _int(stats['activeShoppersToday']),
      ),
    );
  }

  bool get isEmpty =>
      delivery == null &&
      trending.isEmpty &&
      newToday.isEmpty &&
      priceDrops.isEmpty &&
      justOrdered.isEmpty &&
      stats.isEmpty;
}

class PromoHome {
  const PromoHome({this.popups = const [], this.live = const LiveHome()});

  final List<PromoPopup> popups;
  final LiveHome live;

  factory PromoHome.fromJson(Map<String, dynamic> json) => PromoHome(
    popups: _maps(json['popups'])
        .map(PromoPopup.tryParse)
        .whereType<PromoPopup>()
        .toList(),
    live: LiveHome.fromJson(json['live']),
  );
}
