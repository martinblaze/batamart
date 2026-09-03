import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/notifications_repository.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(),
);

final notificationsProvider = FutureProvider.autoDispose<NotificationsResult>((
  ref,
) {
  return ref.watch(notificationsRepositoryProvider).fetchNotifications();
});
