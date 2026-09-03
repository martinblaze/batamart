import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../state/notifications_providers.dart';
import 'notification_router.dart';

/// Matches the collage's "Notifications" frame: list, "Mark all as read",
/// per-type icon, deep-link routing on tap.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(notificationsRepositoryProvider).markAllAsRead();
              ref.invalidate(notificationsProvider);
            },
            child: const Text('Mark all as read'),
          ),
        ],
      ),
      body: notificationsAsync.when(
        data: (result) {
          if (result.notifications.isEmpty) {
            return const EmptyState(title: 'No notifications yet');
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(notificationsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: result.notifications.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final notification = result.notifications[index];
                return Dismissible(
                  key: ValueKey(notification.id),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    color: AppColors.danger,
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: AppSpacing.lg),
                    child: const Icon(Icons.delete, color: Colors.white),
                  ),
                  onDismissed: (_) async {
                    await ref
                        .read(notificationsRepositoryProvider)
                        .delete(notification.id);
                    ref.invalidate(notificationsProvider);
                  },
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.primary.withValues(
                        alpha: 0.12,
                      ),
                      child: Icon(
                        _iconFor(notification.type),
                        color: AppColors.primary,
                        size: 18,
                      ),
                    ),
                    title: Text(
                      notification.message,
                      style: TextStyle(
                        fontWeight: notification.isRead
                            ? FontWeight.w400
                            : FontWeight.w700,
                      ),
                    ),
                    subtitle: notification.createdAt != null
                        ? Text(_relativeTime(notification.createdAt!))
                        : null,
                    trailing: notification.isRead
                        ? null
                        : const CircleAvatar(
                            radius: 4,
                            backgroundColor: AppColors.primary,
                          ),
                    onTap: () async {
                      if (!notification.isRead) {
                        await ref
                            .read(notificationsRepositoryProvider)
                            .markAsRead([notification.id]);
                        ref.invalidate(notificationsProvider);
                      }
                      if (context.mounted) {
                        routeNotification(context, notification);
                      }
                    },
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load notifications.\n$error',
          onRetry: () => ref.invalidate(notificationsProvider),
        ),
      ),
    );
  }

  IconData _iconFor(String type) {
    if (type.startsWith('ORDER_')) return LucideIcons.package;
    if (type.startsWith('DISPUTE_') || type.startsWith('REPORT_')) {
      return LucideIcons.alertTriangle;
    }
    if (type == 'WITHDRAWAL_PROCESSED' || type == 'PAYMENT_RECEIVED') {
      return LucideIcons.wallet;
    }
    if (type == 'REFERRAL_REWARD') return LucideIcons.gift;
    if (type == 'STOCK_ALERT' || type == 'PRODUCT_UNDER_REVIEW') {
      return LucideIcons.store;
    }
    return LucideIcons.bell;
  }

  String _relativeTime(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 60) return '${diff.inMinutes} mins ago';
    if (diff.inHours < 24) return '${diff.inHours} hours ago';
    if (diff.inDays == 1) return 'Yesterday';
    return DateFormat.yMMMd().format(time);
  }
}
