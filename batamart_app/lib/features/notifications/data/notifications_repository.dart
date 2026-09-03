import '../../../core/api/api_client.dart';
import 'notification_models.dart';

class NotificationsResult {
  const NotificationsResult({
    required this.notifications,
    required this.unreadCount,
  });
  final List<AppNotification> notifications;
  final int unreadCount;
}

/// Notifications domain (BACKEND_REFERENCE.md §3.10). Server caches
/// responses 20s per `userId:unreadOnly:limit` — don't poll faster than
/// that expecting fresh data.
class NotificationsRepository {
  final _api = ApiClient.instance;

  Future<NotificationsResult> fetchNotifications({
    bool unreadOnly = false,
  }) async {
    final response = await _api.get(
      '/api/notifications',
      queryParameters: {if (unreadOnly) 'unreadOnly': 'true'},
    );
    return NotificationsResult(
      notifications: (response['notifications'] as List? ?? const [])
          .whereType<Map>()
          .map((n) => AppNotification.fromJson(n.cast<String, dynamic>()))
          .toList(),
      unreadCount: response['unreadCount'] as int? ?? 0,
    );
  }

  Future<void> markAllAsRead() {
    return _api.patch('/api/notifications', data: {'markAllAsRead': true});
  }

  Future<void> markAsRead(List<String> ids) {
    return _api.patch('/api/notifications', data: {'notificationIds': ids});
  }

  Future<void> delete(String id) {
    return _api.delete('/api/notifications', queryParameters: {'id': id});
  }

  Future<void> deleteAll() {
    return _api.delete(
      '/api/notifications',
      queryParameters: {'deleteAll': 'true'},
    );
  }
}
