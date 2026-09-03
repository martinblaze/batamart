import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/status_chip.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../orders/state/orders_providers.dart';
import '../state/disputes_providers.dart';

/// WEB_PAGES_REFERENCE.md's "Dispute: Select Order" — the buyer's
/// delivered orders eligible for a dispute, plus already-disputed ones.
/// `canDispute`/`hasExistingDispute` come straight off
/// `GET /api/orders/my-orders` (BACKEND_REFERENCE.md §3.6); the dispute id
/// for an already-disputed order is cross-referenced from
/// `GET /api/disputes` since my-orders doesn't expose it directly.
class DisputeSelectOrderScreen extends ConsumerWidget {
  const DisputeSelectOrderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(myOrdersProvider);
    final disputesAsync = ref.watch(disputesProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Disputes', showBack: true),
      body: ordersAsync.when(
        data: (orders) {
          final eligible = orders
              .where((o) => o.canDispute || o.hasExistingDispute)
              .toList();
          if (eligible.isEmpty) {
            return const EmptyState(
              title: 'No eligible orders',
              message: 'Disputes can be opened within 48 hours of delivery.',
            );
          }
          final disputeIdByOrder = <String, String>{
            for (final d in disputesAsync.asData?.value ?? const [])
              d.orderId: d.id,
          };

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myOrdersProvider);
              ref.invalidate(disputesProvider);
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: eligible.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                final order = eligible[index];
                return ListTile(
                  tileColor: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  title: Text('Order #${order.orderNumber}'),
                  subtitle: Text(
                    order.createdAt != null
                        ? DateFormat.yMMMd().format(order.createdAt!)
                        : '',
                  ),
                  trailing: order.hasExistingDispute
                      ? StatusChip(
                          status: order.existingDisputeStatus ?? 'OPEN',
                        )
                      : const Icon(Icons.chevron_right),
                  onTap: () {
                    if (order.hasExistingDispute) {
                      final disputeId = disputeIdByOrder[order.id];
                      if (disputeId != null) {
                        context.push(AppRoutes.disputeDetailPath(disputeId));
                      }
                    } else {
                      context.push(AppRoutes.fileDisputePath(order.id));
                    }
                  },
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load your orders.\n$error',
          onRetry: () => ref.invalidate(myOrdersProvider),
        ),
      ),
    );
  }
}
