import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../orders/data/order_models.dart';
import '../state/seller_providers.dart';

enum _SalesTab { newOrders, processing, completed }

/// Matches the collage's seller "Orders" (Sales) frame: New/Processing/
/// Completed tabs with counts, buyer avatar, "Accept" action. Reached
/// from Profile (like My Shop), not a bottom-nav tab — distinct from the
/// buyer's own Orders tab per WEB_PAGES_REFERENCE.md.
class SalesScreen extends ConsumerStatefulWidget {
  const SalesScreen({super.key});

  @override
  ConsumerState<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends ConsumerState<SalesScreen> {
  _SalesTab _tab = _SalesTab.newOrders;

  bool _matchesTab(Order order) {
    switch (_tab) {
      case _SalesTab.newOrders:
        return order.status == 'PENDING';
      case _SalesTab.processing:
        return const {
          'PROCESSING',
          'RIDER_ASSIGNED',
          'PICKED_UP',
          'ON_THE_WAY',
        }.contains(order.status);
      case _SalesTab.completed:
        return const {'DELIVERED', 'COMPLETED'}.contains(order.status);
    }
  }

  Future<void> _accept(Order order) async {
    try {
      await ref.read(sellerOrdersRepositoryProvider).acceptOrder(order.id);
      ref.invalidate(salesProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final salesAsync = ref.watch(salesProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Orders', showBack: true),
      body: salesAsync.when(
        data: (orders) {
          final counts = {
            _SalesTab.newOrders: orders
                .where((o) => o.status == 'PENDING')
                .length,
            _SalesTab.processing: orders
                .where(
                  (o) => const {
                    'PROCESSING',
                    'RIDER_ASSIGNED',
                    'PICKED_UP',
                    'ON_THE_WAY',
                  }.contains(o.status),
                )
                .length,
            _SalesTab.completed: orders
                .where(
                  (o) => const {'DELIVERED', 'COMPLETED'}.contains(o.status),
                )
                .length,
          };
          final filtered = orders.where(_matchesTab).toList();

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  children: [
                    _SalesTabChip(
                      label: 'New',
                      count: counts[_SalesTab.newOrders]!,
                      selected: _tab == _SalesTab.newOrders,
                      onTap: () => setState(() => _tab = _SalesTab.newOrders),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    _SalesTabChip(
                      label: 'Processing',
                      count: counts[_SalesTab.processing]!,
                      selected: _tab == _SalesTab.processing,
                      onTap: () => setState(() => _tab = _SalesTab.processing),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    _SalesTabChip(
                      label: 'Completed',
                      count: counts[_SalesTab.completed]!,
                      selected: _tab == _SalesTab.completed,
                      onTap: () => setState(() => _tab = _SalesTab.completed),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? const EmptyState(title: 'No orders here')
                    : RefreshIndicator(
                        onRefresh: () => ref.refresh(salesProvider.future),
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                          ),
                          itemCount: filtered.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: AppSpacing.md),
                          itemBuilder: (context, index) {
                            final order = filtered[index];
                            return _SaleRow(
                              order: order,
                              onAccept: order.status == 'PENDING'
                                  ? () => _accept(order)
                                  : null,
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load your orders.\n$error',
          onRetry: () => ref.invalidate(salesProvider),
        ),
      ),
    );
  }
}

class _SalesTabChip extends StatelessWidget {
  const _SalesTabChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text('$label ($count)'),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}

class _SaleRow extends StatelessWidget {
  const _SaleRow({required this.order, this.onAccept});

  final Order order;
  final VoidCallback? onAccept;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      onTap: () => context.push(AppRoutes.orderDetailPath(order.id)),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundImage: order.buyerPhoto != null
                  ? CachedNetworkImageProvider(order.buyerPhoto!)
                  : null,
              child: order.buyerPhoto == null ? const Icon(Icons.person) : null,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Order #${order.orderNumber}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (order.createdAt != null)
                    Text(
                      DateFormat.yMMMd().format(order.createdAt!),
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
            if (onAccept != null)
              FilledButton(onPressed: onAccept, child: const Text('Accept'))
            else
              const Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
