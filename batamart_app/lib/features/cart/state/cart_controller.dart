import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../data/cart_models.dart';
import '../data/cart_repository.dart';

final cartRepositoryProvider = Provider<CartRepository>(
  (ref) => CartRepository(),
);

final cartControllerProvider =
    StateNotifierProvider<CartController, List<CartItem>>((ref) {
      return CartController(ref.watch(cartRepositoryProvider));
    });

/// Client-local cart (BACKEND_REFERENCE.md §3.4 — there is no server-side
/// cart API), persisted to a Hive box so it survives app restarts.
class CartController extends StateNotifier<List<CartItem>> {
  CartController(this._repository) : super(const []) {
    _load();
  }

  final CartRepository _repository;
  static const _boxName = 'cart_box';
  static const _itemsKey = 'items';

  Future<Box> _openBox() => Hive.openBox(_boxName);

  Future<void> _load() async {
    final box = await _openBox();
    final raw = box.get(_itemsKey) as List?;
    if (raw == null) return;
    state = raw.whereType<Map>().map((m) => CartItem.fromJson(m)).toList();
  }

  Future<void> _persist() async {
    final box = await _openBox();
    await box.put(_itemsKey, state.map((item) => item.toJson()).toList());
  }

  /// Adds [quantity] of a product to the cart, reconciling against the
  /// live `/api/cart/add` snapshot first. Merges into an existing line
  /// with the same product+variant, capped at the server's `maxQuantity`.
  Future<void> addItem({
    required String productId,
    String? variantId,
    int quantity = 1,
  }) async {
    final fresh = await _repository.reconcile(
      productId: productId,
      variantId: variantId,
      quantity: quantity,
    );

    final existingIndex = state.indexWhere(
      (item) => item.productId == productId && item.variantId == variantId,
    );

    if (existingIndex == -1) {
      state = [...state, fresh];
    } else {
      final existing = state[existingIndex];
      final mergedQuantity = (existing.quantity + quantity).clamp(
        1,
        fresh.maxQuantity,
      );
      final updated = existing.copyWith(quantity: mergedQuantity);
      state = [
        for (var i = 0; i < state.length; i++)
          i == existingIndex ? updated : state[i],
      ];
    }
    await _persist();
  }

  Future<void> updateQuantity(int index, int quantity) async {
    if (index < 0 || index >= state.length) return;
    final item = state[index];
    final clamped = quantity.clamp(1, item.maxQuantity);
    state = [
      for (var i = 0; i < state.length; i++)
        i == index ? state[i].copyWith(quantity: clamped) : state[i],
    ];
    await _persist();
  }

  Future<void> updateOrderNote(int index, String note) async {
    if (index < 0 || index >= state.length) return;
    state = [
      for (var i = 0; i < state.length; i++)
        i == index ? state[i].copyWith(orderNote: note) : state[i],
    ];
    await _persist();
  }

  Future<void> setDeliveryAcknowledged(int index, bool value) async {
    if (index < 0 || index >= state.length) return;
    state = [
      for (var i = 0; i < state.length; i++)
        i == index
            ? state[i].copyWith(buyerDeliveryAcknowledged: value)
            : state[i],
    ];
    await _persist();
  }

  Future<void> removeAt(int index) async {
    if (index < 0 || index >= state.length) return;
    state = [
      for (var i = 0; i < state.length; i++)
        if (i != index) state[i],
    ];
    await _persist();
  }

  Future<void> clear() async {
    state = const [];
    await _persist();
  }

  int get totalItems => state.fold(0, (sum, item) => sum + item.quantity);
  double get subtotal => state.fold(0, (sum, item) => sum + item.lineTotal);
}

/// Live delivery-fee preview for whatever's currently in the cart
/// (BACKEND_REFERENCE.md §3.5) — re-quotes whenever the cart contents
/// change.
final deliveryQuoteProvider =
    FutureProvider.autoDispose<({double fee, int sellerCount})>((ref) {
      final items = ref.watch(cartControllerProvider);
      if (items.isEmpty) return Future.value((fee: 0.0, sellerCount: 0));
      return ref.watch(cartRepositoryProvider).quoteDelivery(items);
    });
