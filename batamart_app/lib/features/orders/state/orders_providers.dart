import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/order_models.dart';
import '../data/orders_repository.dart';
import '../data/reviews_repository.dart';

final ordersRepositoryProvider = Provider<OrdersRepository>(
  (ref) => OrdersRepository(),
);
final reviewsRepositoryProvider = Provider<ReviewsRepository>(
  (ref) => ReviewsRepository(),
);

final myOrdersProvider = FutureProvider.autoDispose<List<Order>>((ref) {
  return ref.watch(ordersRepositoryProvider).fetchMyOrders();
});

final orderDetailProvider = FutureProvider.autoDispose.family<Order, String>((
  ref,
  id,
) {
  return ref.watch(ordersRepositoryProvider).fetchOrder(id);
});

/// Polls `GET /api/orders/{id}/live-location` every 15s while the
/// consuming widget is alive — the endpoint itself is polling-based, no
/// WebSocket/SSE exists (BACKEND_REFERENCE.md §3.6).
final liveLocationProvider = StreamProvider.autoDispose
    .family<OrderLiveLocation, String>((ref, orderId) {
      final repository = ref.watch(ordersRepositoryProvider);
      late final StreamController<OrderLiveLocation> controller;
      Timer? timer;

      Future<void> poll() async {
        try {
          controller.add(await repository.fetchLiveLocation(orderId));
        } catch (e, st) {
          controller.addError(e, st);
        }
      }

      controller = StreamController<OrderLiveLocation>(
        onListen: () {
          poll();
          timer = Timer.periodic(const Duration(seconds: 15), (_) => poll());
        },
        onCancel: () => timer?.cancel(),
      );

      ref.onDispose(() {
        timer?.cancel();
        controller.close();
      });

      return controller.stream;
    });
