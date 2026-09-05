import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/cards/order_card.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/order_models.dart';
import '../state/orders_providers.dart';
import '../../../core/utils/money.dart';

enum _OrdersTab { all, toPay, processing, onTheWay, delivered }

/// Matches the collage's "My Orders" frame: status filter tabs + order
/// cards with a status chip and up to two actions.
///
/// **"To Pay" tab note**: the backend never creates an `Order` row until
/// Flutterwave confirms payment (BACKEND_REFERENCE.md §3.5 — "Order
/// creation timing"), so there is no reachable unpaid-order state in this
/// app's real flow. Kept for visual parity with the mockup, mapped to
/// `PENDING` (the closest real status), but expect it to always be empty.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  _OrdersTab _tab = _OrdersTab.all;

  static const _tabLabels = {
    _OrdersTab.all: 'All',
    _OrdersTab.toPay: 'To Pay',
    _OrdersTab.processing: 'Processing',
    _OrdersTab.onTheWay: 'On the way',
    _OrdersTab.delivered: 'Delivered',
  };

  bool _matchesTab(Order order) {
    switch (_tab) {
      case _OrdersTab.all:
        return true;
      case _OrdersTab.toPay:
        return order.status == 'PENDING';
      case _OrdersTab.processing:
        return order.status == 'PROCESSING';
      case _OrdersTab.onTheWay:
        return const {
          'RIDER_ASSIGNED',
          'PICKED_UP',
          'ON_THE_WAY',
        }.contains(order.status);
      case _OrdersTab.delivered:
        return const {'DELIVERED', 'COMPLETED'}.contains(order.status);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(myOrdersProvider);

    return Column(
      children: [
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.sm,
            ),
            itemCount: _OrdersTab.values.length,
            separatorBuilder: (context, index) =>
                const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, index) {
              final tab = _OrdersTab.values[index];
              return ChoiceChip(
                label: Text(_tabLabels[tab]!),
                selected: _tab == tab,
                onSelected: (_) => setState(() => _tab = tab),
              );
            },
          ),
        ),
        Expanded(
          child: ordersAsync.when(
            data: (orders) {
              final filtered = orders.where(_matchesTab).toList();
              if (filtered.isEmpty) {
                return const EmptyState(
                  title: 'No orders here',
                  message: 'Orders you place will show up here.',
                );
              }
              return RefreshIndicator(
                onRefresh: () => ref.refresh(myOrdersProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    final order = filtered[index];
                    final needsReview =
                        const {
                          'DELIVERED',
                          'COMPLETED',
                        }.contains(order.status) &&
                        !(order.hasProductReview && order.hasSellerReview);

                    return OrderCard(
                      orderNumber: 'Order #${order.orderNumber}',
                      date: order.createdAt != null
                          ? DateFormat.yMMMd().format(order.createdAt!)
                          : '',
                      itemsLabel:
                          '${order.quantity} item${order.quantity == 1 ? '' : 's'}',
                      total: naira(order.totalAmount),
                      status: order.status,
                      onTap: () =>
                          context.push(AppRoutes.orderDetailPath(order.id)),
                      actionLabel: 'View Details',
                      onActionTap: () =>
                          context.push(AppRoutes.orderDetailPath(order.id)),
                      secondaryActionLabel: needsReview ? 'Review' : null,
                      onSecondaryActionTap: needsReview
                          ? () => context.push(
                              AppRoutes.reviewProductPath(order.id),
                            )
                          : null,
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
        ),
      ],
    );
  }
}
