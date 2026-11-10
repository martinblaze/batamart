import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/state/auth_controller.dart';
import '../data/wishlist_repository.dart';

final wishlistRepositoryProvider = Provider<WishlistRepository>(
  (ref) => WishlistRepository(),
);

/// The set of saved product ids, fetched once and shared by every heart in the
/// app, so a feed of forty cards makes one request rather than forty. Rebuilt
/// (and so re-fetched) when the user signs in or out.
class WishlistIdsController extends StateNotifier<Set<String>> {
  WishlistIdsController(this._repo, {required bool signedIn})
    : _signedIn = signedIn,
      super(const {}) {
    if (signedIn) _load();
  }

  final WishlistRepository _repo;
  final bool _signedIn;

  bool get signedIn => _signedIn;

  Future<void> _load() async {
    try {
      final ids = await _repo.ids();
      if (mounted) state = ids;
    } catch (e) {
      // Hearts just render empty; saving still works.
      debugPrint('WishlistIds: could not load ($e)');
    }
  }

  Future<void> refresh() => _load();

  /// Optimistic. Returns the new saved state, or null when the call failed and
  /// was rolled back.
  Future<bool?> toggle(String productId) async {
    final wasSaved = state.contains(productId);
    state = wasSaved
        ? ({...state}..remove(productId))
        : {...state, productId};
    try {
      if (wasSaved) {
        await _repo.remove(productId);
      } else {
        await _repo.add(productId);
      }
      return !wasSaved;
    } catch (e) {
      if (mounted) {
        state = wasSaved
            ? {...state, productId}
            : ({...state}..remove(productId));
      }
      return null;
    }
  }
}

final wishlistIdsProvider =
    StateNotifierProvider<WishlistIdsController, Set<String>>((ref) {
      final signedIn = ref.watch(
        authControllerProvider.select((s) => s.isAuthenticated),
      );
      return WishlistIdsController(
        ref.watch(wishlistRepositoryProvider),
        signedIn: signedIn,
      );
    });

final wishlistItemsProvider = FutureProvider.autoDispose<List<WishlistItem>>(
  (ref) => ref.watch(wishlistRepositoryProvider).list(),
);
