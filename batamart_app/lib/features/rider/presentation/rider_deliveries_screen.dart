import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/status_chip.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_dialog.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../orders/data/order_models.dart';
import '../state/rider_providers.dart';

enum _DeliveriesTab { active, completed }

/// Matches the collage's "Rider Deliveries" frame: Active/Completed tabs,
/// per-order status-advance actions. **"Completed" is necessarily empty**
/// — `GET /api/riders/my-deliveries` only returns
/// `RIDER_ASSIGNED`/`IN_PROGRESS` batches (BACKEND_REFERENCE.md §3.12
/// explicitly notes no delivery-history route exists among the documented
/// endpoints). Kept for visual parity with the mockup; flagged in README.
class RiderDeliveriesScreen extends ConsumerStatefulWidget {
  const RiderDeliveriesScreen({super.key});

  @override
  ConsumerState<RiderDeliveriesScreen> createState() =>
      _RiderDeliveriesScreenState();
}

class _RiderDeliveriesScreenState extends ConsumerState<RiderDeliveriesScreen> {
  _DeliveriesTab _tab = _DeliveriesTab.active;
  bool _isBroadcasting = false;

  @override
  void dispose() {
    ref.read(locationBroadcastServiceProvider).stop();
    super.dispose();
  }

  Future<void> _toggleBroadcast(String? batchId) async {
    final service = ref.read(locationBroadcastServiceProvider);
    if (_isBroadcasting) {
      service.stop();
      setState(() => _isBroadcasting = false);
      return;
    }
    final granted = await service.ensurePermission();
    if (!granted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Location permission is required to broadcast your position.',
            ),
          ),
        );
      }
      return;
    }
    service.start(batchId: batchId);
    setState(() => _isBroadcasting = true);
  }

  @override
  Widget build(BuildContext context) {
    final deliveriesAsync = ref.watch(myDeliveriesProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              ChoiceChip(
                label: const Text('Active'),
                selected: _tab == _DeliveriesTab.active,
                onSelected: (_) => setState(() => _tab = _DeliveriesTab.active),
              ),
              const SizedBox(width: AppSpacing.sm),
              ChoiceChip(
                label: const Text('Completed'),
                selected: _tab == _DeliveriesTab.completed,
                onSelected: (_) =>
                    setState(() => _tab = _DeliveriesTab.completed),
              ),
            ],
          ),
        ),
        Expanded(
          child: _tab == _DeliveriesTab.completed
              ? const EmptyState(
                  title: 'No delivery history available',
                  message:
                      'The backend does not expose a completed-deliveries endpoint yet.',
                )
              : deliveriesAsync.when(
                  data: (batches) {
                    if (batches.isEmpty) {
                      return const EmptyState(
                        title: 'No active deliveries',
                        message:
                            'Accept a batch from the Dashboard tab to get started.',
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: () => ref.refresh(myDeliveriesProvider.future),
                      child: ListView(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                        ),
                        children: [
                          for (final batch in batches) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Batch #${batch.batchNumber ?? batch.id.substring(0, 6)}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                TextButton.icon(
                                  onPressed: () => _toggleBroadcast(batch.id),
                                  icon: Icon(
                                    Icons.location_on,
                                    size: 16,
                                    color: _isBroadcasting
                                        ? AppColors.success
                                        : context.palette.inkSecondary,
                                  ),
                                  label: Text(
                                    _isBroadcasting
                                        ? 'Broadcasting'
                                        : 'Broadcast Location',
                                  ),
                                ),
                              ],
                            ),
                            for (final order in batch.orders)
                              _DeliveryOrderCard(order: order),
                            const SizedBox(height: AppSpacing.lg),
                          ],
                        ],
                      ),
                    );
                  },
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (error, stackTrace) => ErrorState(
                    message: 'Could not load your deliveries.\n$error',
                    onRetry: () => ref.invalidate(myDeliveriesProvider),
                  ),
                ),
        ),
      ],
    );
  }
}

class _DeliveryOrderCard extends ConsumerStatefulWidget {
  const _DeliveryOrderCard({required this.order});

  final Order order;

  @override
  ConsumerState<_DeliveryOrderCard> createState() => _DeliveryOrderCardState();
}

class _DeliveryOrderCardState extends ConsumerState<_DeliveryOrderCard> {
  bool _isUpdating = false;

  String? get _nextStatus => switch (widget.order.status) {
    'RIDER_ASSIGNED' => 'PICKED_UP',
    'PICKED_UP' => 'ON_THE_WAY',
    'ON_THE_WAY' => 'DELIVERED',
    _ => null,
  };

  String get _actionLabel => switch (_nextStatus) {
    'PICKED_UP' => 'Mark Picked Up',
    'ON_THE_WAY' => 'Mark On The Way',
    'DELIVERED' => 'Mark Delivered',
    _ => '',
  };

  Future<void> _advance() async {
    final next = _nextStatus;
    if (next == null) return;
    setState(() => _isUpdating = true);
    try {
      await ref
          .read(riderRepositoryProvider)
          .updateOrderStatus(widget.order.id, next);
      ref.invalidate(myDeliveriesProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  Future<void> _confirmReturnPickup() async {
    setState(() => _isUpdating = true);
    try {
      await ref
          .read(riderRepositoryProvider)
          .confirmDisputePickedUp(widget.order.id);
      ref.invalidate(myDeliveriesProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  Future<void> _declineOversized() async {
    final confirmed = await AppDialog.confirm(
      context: context,
      title: 'Decline — Item Too Large?',
      message:
          'This cancels the order and refunds the buyer (product amount only; you keep your delivery-fee cut).',
      confirmLabel: 'Decline',
      isDestructive: true,
    );
    if (!confirmed) return;

    setState(() => _isUpdating = true);
    try {
      await ref.read(riderRepositoryProvider).declineOversized(widget.order.id);
      ref.invalidate(myDeliveriesProvider);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    // A dispute-return leg is still `RIDER_ASSIGNED` like a normal order,
    // but the rider progresses it via `dispute-picked-up` instead of the
    // normal `update-status` call (BACKEND_REFERENCE.md §3.12) —
    // `hasExistingDispute` is the closest signal `Order` carries for this
    // without exposing the dispute's internal resolution sentinel here.
    final isReturnPickup =
        order.status == 'RIDER_ASSIGNED' && order.hasExistingDispute;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: context.palette.hairline),
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => context.push(AppRoutes.orderDetailPath(order.id)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Order #${order.orderNumber}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                StatusChip(status: order.status),
              ],
            ),
          ),
          Text(
            order.deliveryAddress,
            style: TextStyle(
              color: context.palette.inkSecondary,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (isReturnPickup)
            PrimaryButton(
              label: 'Mark Collected',
              onPressed: _confirmReturnPickup,
              isLoading: _isUpdating,
            )
          else if (_nextStatus != null)
            Row(
              children: [
                Expanded(
                  child: PrimaryButton(
                    label: _actionLabel,
                    onPressed: _advance,
                    isLoading: _isUpdating,
                  ),
                ),
                if (order.status == 'RIDER_ASSIGNED') ...[
                  const SizedBox(width: AppSpacing.sm),
                  IconButton(
                    tooltip: 'Item too large',
                    icon: const Icon(
                      Icons.report_gmailerrorred,
                      color: AppColors.danger,
                    ),
                    onPressed: _isUpdating ? null : _declineOversized,
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }
}
