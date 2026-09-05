import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/status_chip.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../../orders/data/order_models.dart';
import '../data/rider_models.dart';
import '../state/rider_providers.dart';
import '../../../core/utils/money.dart';

/// Matches the collage's "Good morning" rider dashboard frame: online
/// toggle, Available Batches (claimable), Active Delivery summary. This
/// is the "Dashboard" nav tab; "Deliveries" is the same underlying data
/// viewed in more operational detail (`RiderDeliveriesScreen`) — per
/// WEB_PAGES_REFERENCE.md, "same dashboard, different internal tab."
class RiderDashboardScreen extends ConsumerWidget {
  const RiderDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final availableAsync = ref.watch(availableOrdersProvider);
    final myDeliveriesAsync = ref.watch(myDeliveriesProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(availableOrdersProvider);
        ref.invalidate(myDeliveriesProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            'Good morning, ${user?.name.split(' ').first ?? ''} 👋',
            style: AppTypography.display(size: 18, weight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.sm),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              user?.isAvailable ?? false ? "You're Online" : "You're Offline",
            ),
            value: user?.isAvailable ?? false,
            activeThumbColor: AppColors.success,
            onChanged: (_) async {
              await ref.read(riderRepositoryProvider).toggleAvailability();
              await ref.read(authControllerProvider.notifier).refreshUser();
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Available Batches',
            style: AppTypography.display(size: 16, weight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.sm),
          availableAsync.when(
            data: (result) {
              if (result.batches.isEmpty && result.disputePickups.isEmpty) {
                return Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                  child: Text(
                    'No batches available right now.',
                    style: TextStyle(color: context.palette.inkSecondary),
                  ),
                );
              }
              return Column(
                children: [
                  for (final batch in result.batches)
                    _AvailableBatchCard(
                      batch: batch,
                      onAccept: () => _acceptBatch(context, ref, batch.id),
                    ),
                  if (result.disputePickups.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    const Text(
                      'Return Pickups',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    for (final order in result.disputePickups)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(
                          LucideIcons.rotateCcw,
                          color: AppColors.warning,
                        ),
                        title: Text('Order #${order.orderNumber}'),
                        subtitle: const Text('Collect return item from buyer'),
                        onTap: () =>
                            context.push(AppRoutes.orderDetailPath(order.id)),
                      ),
                  ],
                ],
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stackTrace) => ErrorState(
              message: 'Could not load available batches.\n$error',
              onRetry: () => ref.invalidate(availableOrdersProvider),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            'Active Delivery',
            style: AppTypography.display(size: 16, weight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.sm),
          myDeliveriesAsync.when(
            data: (batches) {
              if (batches.isEmpty) {
                return const EmptyState(
                  title: 'No active deliveries',
                  message: 'Accept a batch to get started.',
                );
              }
              return Column(
                children: [
                  for (final batch in batches)
                    for (final order in batch.orders)
                      if (!const {
                        'DELIVERED',
                        'COMPLETED',
                      }.contains(order.status))
                        _ActiveOrderCard(order: order),
                ],
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stackTrace) =>
                Text('Could not load active deliveries.\n$error'),
          ),
        ],
      ),
    );
  }

  Future<void> _acceptBatch(
    BuildContext context,
    WidgetRef ref,
    String batchId,
  ) async {
    try {
      await ref.read(riderRepositoryProvider).acceptBatch(batchId);
      ref.invalidate(availableOrdersProvider);
      ref.invalidate(myDeliveriesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Batch accepted!')));
      }
    } on ApiException catch (e) {
      final blockReason = e.body?['blockReason'] as String?;
      final message = switch (blockReason) {
        'DISPUTE_PICKUP_PENDING' => 'Finish your pending return pickup first.',
        'ACTIVE_DELIVERY' =>
          'You already have an active batch — finish it first.',
        'AWAITING_SELLER_ACCEPTANCE' =>
          'The seller hasn\'t accepted this order yet.',
        'CAMPAIGN_DELIVERY_NOT_STARTED' =>
          'This campaign\'s delivery window hasn\'t opened yet.',
        _ => e.message,
      };
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
      }
    }
  }
}

class _AvailableBatchCard extends StatelessWidget {
  const _AvailableBatchCard({required this.batch, required this.onAccept});

  final DeliveryBatch batch;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: context.palette.hairline),
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Batch #${batch.batchNumber ?? batch.id.substring(0, 6)}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                Text(
                  '${batch.orderCount} Orders',
                  style: TextStyle(color: context.palette.inkSecondary),
                ),
                Text(
                  naira(batch.totalDeliveryFee),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
          PrimaryButton(label: 'Accept', onPressed: onAccept, expand: false),
        ],
      ),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: context.palette.hairline),
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Order #${order.orderNumber}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    StatusChip(status: order.status),
                  ],
                ),
                Text(
                  order.deliveryAddress,
                  style: TextStyle(
                    color: context.palette.inkSecondary,
                    fontSize: 12,
                  ),
                ),
                Text(naira(order.deliveryFee)),
              ],
            ),
          ),
          PrimaryButton(
            label: 'Navigate',
            expand: false,
            onPressed: () => launchUrl(
              Uri.parse(
                'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(order.deliveryAddress)}',
              ),
              mode: LaunchMode.externalApplication,
            ),
          ),
        ],
      ),
    );
  }
}
