import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

const _boxName = 'recent_searches_box';
const _key = 'terms';
const _maxTerms = 10;

/// Recent search terms, persisted locally.
///
/// Deliberately device-local rather than server-side: there is no
/// search-history endpoint in the API, and inventing one would mean a second
/// data layer. Hive is already the app's local store, so this rides along with
/// the cart's persistence.
class RecentSearchesController extends StateNotifier<List<String>> {
  RecentSearchesController() : super(const []) {
    _load();
  }

  Future<Box> _openBox() => Hive.openBox(_boxName);

  Future<void> _load() async {
    final box = await _openBox();
    final stored = box.get(_key);
    if (stored is List) {
      state = stored.whereType<String>().toList(growable: false);
    }
  }

  Future<void> add(String term) async {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return;

    // Case-insensitive de-dupe, most recent first, capped — otherwise the list
    // becomes a wall of near-identical typos.
    final next = [
      trimmed,
      ...state.where((t) => t.toLowerCase() != trimmed.toLowerCase()),
    ].take(_maxTerms).toList(growable: false);

    state = next;
    (await _openBox()).put(_key, next);
  }

  Future<void> remove(String term) async {
    final next = state.where((t) => t != term).toList(growable: false);
    state = next;
    (await _openBox()).put(_key, next);
  }

  Future<void> clear() async {
    state = const [];
    (await _openBox()).delete(_key);
  }
}

final recentSearchesProvider =
    StateNotifierProvider<RecentSearchesController, List<String>>(
  (ref) => RecentSearchesController(),
);

/// Suggested searches shown before anything is typed.
///
/// Static rather than server-derived: there is no trending-terms endpoint, and
/// a fabricated "trending" list backed by nothing would be a lie. These are
/// simply the things students on a campus marketplace look for most, and each
/// one runs a real search.
const trendingSearches = <String>[
  'iPhone',
  'Textbooks',
  'Sneakers',
  'Power bank',
  'Hostel bedding',
  'Lab coat',
  'Earbuds',
  'Laptop',
  'Skincare',
  'Past questions',
];
