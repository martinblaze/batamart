import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../data/product_models.dart';

const _boxName = 'recently_viewed_box';
const _key = 'items';
const _maxItems = 20;

/// Just enough of a product to draw its card and open its page again. The
/// live price and stock are re-read on the product page itself.
class RecentItem {
  const RecentItem({
    required this.id,
    required this.name,
    required this.image,
    required this.price,
    this.landmark,
  });

  final String id;
  final String name;
  final String image;
  final double price;
  final String? landmark;

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'image': image,
    'price': price,
    'landmark': landmark,
  };

  static RecentItem? fromMap(dynamic raw) {
    if (raw is! Map) return null;
    final id = raw['id'];
    final name = raw['name'];
    if (id is! String || name is! String) return null;
    return RecentItem(
      id: id,
      name: name,
      image: (raw['image'] as String?) ?? '',
      price: (raw['price'] as num?)?.toDouble() ?? 0,
      landmark: raw['landmark'] as String?,
    );
  }
}

/// Products the user has opened, newest first, kept on the device (as on the
/// web). Device-local on purpose: no server history exists for this.
class RecentlyViewedController extends StateNotifier<List<RecentItem>> {
  RecentlyViewedController() : super(const []) {
    _load();
  }

  Future<Box> _openBox() => Hive.openBox(_boxName);

  Future<void> _load() async {
    final stored = (await _openBox()).get(_key);
    if (stored is List) {
      state = stored.map(RecentItem.fromMap).whereType<RecentItem>().toList(growable: false);
    }
  }

  Future<void> add(Product product) async {
    final item = RecentItem(
      id: product.id,
      name: product.name,
      image: product.thumbnail,
      price: product.price,
      landmark: product.landmark,
    );
    final next = [item, ...state.where((i) => i.id != item.id)].take(_maxItems).toList(growable: false);
    state = next;
    (await _openBox()).put(_key, next.map((i) => i.toMap()).toList());
  }

  Future<void> clear() async {
    state = const [];
    (await _openBox()).delete(_key);
  }
}

final recentlyViewedProvider =
    StateNotifierProvider<RecentlyViewedController, List<RecentItem>>(
      (ref) => RecentlyViewedController(),
    );
