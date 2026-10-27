import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/status_chip.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/chrome/app_dialog.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../../rider/state/rider_providers.dart';
import '../../seller/state/seller_providers.dart';
import '../data/order_models.dart';
import '../state/orders_providers.dart';
import '../../../core/utils/money.dart';

/// WEB_PAGES_REFERENCE.md's "Order Detail" is a **universal** screen that
/// renders differently by viewer role — this is the buyer view (seller/
/// rider views land in Phases 7/10 reusing the same route). Also covers
/// the collage's separate "Order Tracking" frame, which is really just
/// this screen while the order is in an active-delivery status.
class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: const BataAppBar(title: 'Order Tracking', showBack: true),
      body: orderAsync.when(
        data: (order) => _OrderDetailBody(order: order),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load this order.\n$error',
          onRetry: () => ref.invalidate(orderDetailProvider(orderId)),
        ),
      ),
    );
  }
}

class _OrderDetailBody extends ConsumerStatefulWidget {
  const _OrderDetailBody({required this.order});

  final Order order;

  @override
  ConsumerState<_OrderDetailBody> createState() => _OrderDetailBodyState();
}

class _OrderDetailBodyState extends ConsumerState<_OrderDetailBody> {
  bool _isConfirming = false;
  bool _isRiderUpdating = false;

  // Riders no longer advance normal orders: the vendor marks "picked up" and
  // the buyer marks "delivered". Only dispute-return legs are driven here.
  String? get _riderNextStatus => widget.order.hasExistingDispute
      ? switch (widget.order.status) {
          'PICKED_UP' => 'ON_THE_WAY',
          'ON_THE_WAY' => 'DELIVERED',
          _ => null,
        }
      : null;

  bool get _isReturnPickupLeg =>
      widget.order.status == 'RIDER_ASSIGNED' &&
      widget.order.hasExistingDispute;

  Future<void> _advanceAsRider() async {
    final next = _riderNextStatus;
    if (next == null) return;
    setState(() => _isRiderUpdating = true);
    try {
      await ref
          .read(riderRepositoryProvider)
          .updateOrderStatus(widget.order.id, next);
      ref.invalidate(orderDetailProvider(widget.order.id));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _isRiderUpdating = false);
    }
  }

  Future<void> _confirmReturnPickupAsRider() async {
    setState(() => _isRiderUpdating = true);
    try {
      await ref
          .read(riderRepositoryProvider)
          .confirmDisputePickedUp(widget.order.id);
      ref.invalidate(orderDetailProvider(widget.order.id));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _isRiderUpdating = false);
    }
  }

  Future<void> _acceptAsSeller(BuildContext context) async {
    try {
      await ref
          .read(sellerOrdersRepositoryProvider)
          .acceptOrder(widget.order.id);
      ref.invalidate(orderDetailProvider(widget.order.id));
      ref.invalidate(salesProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _confirmReceived() async {
    final confirmed = await AppDialog.confirm(
      context: context,
      title: 'Confirm Received?',
      message: 'This releases the seller\'s escrow and closes the order.',
      confirmLabel: 'Confirm',
    );
    if (!confirmed) return;

    setState(() => _isConfirming = true);
    try {
      await ref.read(ordersRepositoryProvider).confirmDelivery(widget.order.id);
      ref.invalidate(orderDetailProvider(widget.order.id));
      ref.invalidate(myOrdersProvider);
      if (mounted) {
        context.push(AppRoutes.reviewProductPath(widget.order.id));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _isConfirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final currentUserId = ref.watch(authControllerProvider).user?.id;
    final isSellerView =
        currentUserId != null && currentUserId == order.sellerId;
    final isRiderView = currentUserId != null && currentUserId == order.riderId;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Order #${order.orderNumber}',
              style: AppTypography.display(size: 18, weight: FontWeight.w700),
            ),
            StatusChip(status: order.status),
          ],
        ),
        if (order.createdAt != null)
          Text(
            DateFormat.yMMMd().add_jm().format(order.createdAt!),
            style: TextStyle(
              color: context.palette.inkSecondary,
              fontSize: 12,
            ),
          ),
        const SizedBox(height: AppSpacing.lg),
        _TrackingStepper(
          stepIndex: order.trackingStepIndex,
          status: order.status,
        ),
        if (order.hasRider) ...[
          const SizedBox(height: AppSpacing.lg),
          _RiderCard(order: order),
        ],
        if (order.isActiveDelivery) ...[
          const SizedBox(height: AppSpacing.lg),
          _LiveLocationSection(orderId: order.id),
        ],
        const SizedBox(height: AppSpacing.xl),
        const Text(
          'Order Items',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.sm),
              child: AppNetworkImage(order.thumbnail, width: 56, height: 56),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    order.productName ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    'Qty: ${order.quantity}',
                    style: TextStyle(color: context.palette.inkSecondary),
                  ),
                ],
              ),
            ),
            Text(
              naira(order.totalAmount),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        if (order.deliveryAddress.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          const Text(
            'Delivery Address',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(order.deliveryAddress),
        ],
        // Seller view shows who bought it; buyer view shows who's selling
        // it — never both, and never a link to yourself.
        if (isSellerView && order.buyerName != null) ...[
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Icon(
                LucideIcons.user,
                size: 18,
                color: context.palette.inkSecondary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                order.buyerName!,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              if (order.deliveryPhone != null) ...[
                const Spacer(),
                IconButton(
                  tooltip: 'Call buyer',
                  icon: const Icon(LucideIcons.phone, size: 18),
                  onPressed: () =>
                      launchUrl(Uri.parse('tel:${order.deliveryPhone}')),
                ),
              ],
            ],
          ),
        ] else if (!isSellerView && order.sellerName != null) ...[
          const SizedBox(height: AppSpacing.lg),
          GestureDetector(
            onTap: () => order.sellerId != null
                ? context.push(AppRoutes.sellerProfilePath(order.sellerId!))
                : null,
            child: Row(
              children: [
                const Icon(
                  LucideIcons.store,
                  size: 18,
                  color: AppColors.primary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  order.sellerName!,
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        if (isSellerView) ...[
          if (order.status == 'PENDING')
            PrimaryButton(
              label: 'Accept Order',
              onPressed: () => _acceptAsSeller(context),
            ),
        ] else if (isRiderView) ...[
          if (_isReturnPickupLeg)
            PrimaryButton(
              label: 'Mark Collected',
              onPressed: _confirmReturnPickupAsRider,
              isLoading: _isRiderUpdating,
            )
          else if (_riderNextStatus != null)
            PrimaryButton(
              label: switch (_riderNextStatus) {
                'ON_THE_WAY' => 'Mark On The Way',
                _ => 'Mark Delivered',
              },
              onPressed: _advanceAsRider,
              isLoading: _isRiderUpdating,
            ),
        ] else ...[
          if (order.status == 'DELIVERED' || order.status == 'ON_THE_WAY')
            PrimaryButton(
              label: order.status == 'ON_THE_WAY'
                  ? 'Mark Delivered'
                  : 'Confirm Received',
              onPressed: _confirmReceived,
              isLoading: _isConfirming,
            ),
          if (const {'DELIVERED', 'COMPLETED'}.contains(order.status) &&
              !(order.hasProductReview && order.hasSellerReview)) ...[
            const SizedBox(height: AppSpacing.sm),
            SecondaryButton(
              label: 'Leave a Review',
              onPressed: () =>
                  context.push(AppRoutes.reviewProductPath(order.id)),
            ),
          ],
          if (order.canDispute && !order.hasExistingDispute) ...[
            const SizedBox(height: AppSpacing.sm),
            SecondaryButton(
              label: 'File a Dispute',
              onPressed: () =>
                  context.push(AppRoutes.fileDisputePath(order.id)),
            ),
          ],
          if (order.hasExistingDispute) ...[
            const SizedBox(height: AppSpacing.sm),
            SecondaryButton(
              label: 'View Dispute',
              onPressed: order.disputeId != null
                  ? () => context.push(
                      AppRoutes.disputeDetailPath(order.disputeId!),
                    )
                  : () => context.push(AppRoutes.disputes),
            ),
          ],
          if (order.hasRider) ...[
            const SizedBox(height: AppSpacing.sm),
            SecondaryButton(
              label: 'Report Rider',
              onPressed: () => context.push(
                AppRoutes.report,
                extra: {
                  'type': 'RIDER',
                  'reportedUserId': order.riderId,
                  'reportedOrderId': order.id,
                  'subjectLabel':
                      'Reporting ${order.riderName ?? 'rider'} for Order #${order.orderNumber}',
                },
              ),
            ),
          ],
        ],
      ],
    );
  }
}

class _TrackingStepper extends StatelessWidget {
  const _TrackingStepper({required this.stepIndex, required this.status});

  final int stepIndex;
  final String status;

  static const _labels = ['Confirmed', 'Processing', 'On the way', 'Delivered'];

  @override
  Widget build(BuildContext context) {
    if (status == 'CANCELLED' || status == 'DISPUTED') {
      return const SizedBox.shrink();
    }

    return Row(
      children: [
        for (var i = 0; i < _labels.length; i++) ...[
          Expanded(
            child: Column(
              children: [
                // Square, not a circle — this is a progress marker, and the
                // system reserves full radius for avatars and status dots.
                Container(
                  width: 24,
                  height: 24,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i <= stepIndex
                        ? context.palette.ink
                        : context.palette.card,
                    border: Border.all(
                      color: i <= stepIndex
                          ? context.palette.ink
                          : context.palette.hairline,
                    ),
                  ),
                  child: Icon(
                    i < stepIndex
                        ? Icons.check
                        : i == stepIndex
                        ? Icons.radio_button_checked
                        : Icons.circle,
                    size: 11,
                    // The icon has to follow its own background: a white glyph
                    // on the unreached step's pale fill was invisible.
                    color: i <= stepIndex
                        ? context.palette.card
                        : context.palette.inkMuted,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _labels[i],
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 10,
                    color: i <= stepIndex
                        ? AppColors.primary
                        : context.palette.inkSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (i != _labels.length - 1)
            Expanded(
              child: Container(
                height: 2,
                color: i < stepIndex ? AppColors.primary : context.palette.hairline,
              ),
            ),
        ],
      ],
    );
  }
}

class _RiderCard extends StatelessWidget {
  const _RiderCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: context.palette.hairline),
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundImage: order.riderProfilePhoto != null
                ? CachedNetworkImageProvider(order.riderProfilePhoto!)
                : null,
            child: order.riderProfilePhoto == null
                ? const Icon(Icons.person)
                : null,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              order.riderName ?? 'Rider',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          if (order.riderPhone != null)
            IconButton(
              tooltip: 'Call rider',
              icon: const Icon(LucideIcons.phone),
              onPressed: () => launchUrl(Uri.parse('tel:${order.riderPhone}')),
            ),
        ],
      ),
    );
  }
}

class _LiveLocationSection extends ConsumerWidget {
  const _LiveLocationSection({required this.orderId});

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locationAsync = ref.watch(liveLocationProvider(orderId));

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.palette.page,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(LucideIcons.mapPin, size: 18, color: AppColors.primary),
              SizedBox(width: AppSpacing.sm),
              Text(
                'Rider Live Location',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          locationAsync.when(
            data: (location) {
              final point = location.latestPoint;
              if (point == null) {
                return Text(
                  'No location updates yet — the rider hasn\'t started broadcasting GPS.',
                  style: TextStyle(
                    color: context.palette.inkSecondary,
                    fontSize: 12,
                  ),
                );
              }
              return Text(
                'Last seen at ${point.lat.toStringAsFixed(5)}, ${point.lng.toStringAsFixed(5)}'
                '${point.at != null ? ' • ${DateFormat.jm().format(point.at!)}' : ''}\n'
                '(Map view needs a Google Maps API key — not yet supplied.)',
                style: TextStyle(
                  color: context.palette.inkSecondary,
                  fontSize: 12,
                ),
              );
            },
            loading: () => const LinearProgressIndicator(),
            error: (error, stackTrace) => const Text(
              'Could not fetch the rider\'s location right now.',
              style: TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
