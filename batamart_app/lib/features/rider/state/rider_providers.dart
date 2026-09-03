import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/location_broadcast_service.dart';
import '../data/rider_models.dart';
import '../data/rider_repository.dart';

final riderRepositoryProvider = Provider<RiderRepository>(
  (ref) => RiderRepository(),
);

final locationBroadcastServiceProvider = Provider<LocationBroadcastService>((
  ref,
) {
  final service = LocationBroadcastService(ref.watch(riderRepositoryProvider));
  ref.onDispose(service.stop);
  return service;
});

final availableOrdersProvider =
    FutureProvider.autoDispose<AvailableOrdersResult>((ref) {
      return ref.watch(riderRepositoryProvider).fetchAvailableOrders();
    });

final myDeliveriesProvider = FutureProvider.autoDispose<List<DeliveryBatch>>((
  ref,
) {
  return ref.watch(riderRepositoryProvider).fetchMyDeliveries();
});
