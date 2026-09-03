import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../auth/state/auth_controller.dart';
import '../data/cart_models.dart';
import '../state/cart_controller.dart';

/// Matches the collage's "My Cart" frame: items grouped by seller, qty
/// steppers, delivery-to summary, delivery fee, total, "Secure Checkout".
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(cartControllerProvider);
    final user = ref.watch(authControllerProvider).user;
    final quoteAsync = ref.watch(deliveryQuoteProvider);

    if (items.isEmpty) {
      return const EmptyState(
        title: 'Your cart is empty',
        message: 'Browse the marketplace to find something you like.',
      );
    }

    final bySeller = <String, List<MapEntry<int, CartItem>>>{};
    for (var i = 0; i < items.length; i++) {
      bySeller
          .putIfAbsent(items[i].sellerId, () => [])
          .add(MapEntry(i, items[i]));
    }

    final subtotal = ref.read(cartControllerProvider.notifier).subtotal;
    final deliveryFee = quoteAsync.asData?.value.fee ?? 0;
    final total = subtotal + deliveryFee;
    final deliveryAddress = [
      user?.hostelName,
      user?.roomNumber,
      user?.landmark,
    ].where((s) => s != null && s.isNotEmpty).join(', ');

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        for (final entry in bySeller.entries) _SellerGroup(items: entry.value),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Delivery to',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            TextButton(
              onPressed: () => context.push(AppRoutes.profileSetup),
              child: const Text('Change'),
            ),
          ],
        ),
        Text(
          deliveryAddress.isEmpty
              ? 'No delivery address on file'
              : deliveryAddress,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Delivery Fee',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            Text('₦${deliveryFee.toStringAsFixed(0)}'),
          ],
        ),
        const Divider(height: AppSpacing.xl),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Total (${ref.read(cartControllerProvider.notifier).totalItems} items)',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            Text(
              '₦${total.toStringAsFixed(0)}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(
          label: 'Secure Checkout',
          onPressed: () => context.push(AppRoutes.checkout),
        ),
      ],
    );
  }
}

class _SellerGroup extends ConsumerWidget {
  const _SellerGroup({required this.items});

  final List<MapEntry<int, CartItem>> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sellerName = items.first.value.sellerName;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => context.push(
              AppRoutes.sellerProfilePath(items.first.value.sellerId),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: AppColors.primary,
                  child: Text(
                    sellerName.isNotEmpty ? sellerName[0].toUpperCase() : '?',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  sellerName,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final entry in items)
            _CartItemRow(index: entry.key, item: entry.value),
        ],
      ),
    );
  }
}

class _CartItemRow extends ConsumerWidget {
  const _CartItemRow({required this.index, required this.item});

  final int index;
  final CartItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(cartControllerProvider.notifier);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => context.push(
                AppRoutes.productDetailPath(item.productId),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                    child: AppNetworkImage(item.image, width: 56, height: 56),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '₦${item.price.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          _QuantityStepper(
            quantity: item.quantity,
            onDecrement: item.quantity > 1
                ? () => controller.updateQuantity(index, item.quantity - 1)
                : () => controller.removeAt(index),
            onIncrement: item.quantity < item.maxQuantity
                ? () => controller.updateQuantity(index, item.quantity + 1)
                : null,
          ),
        ],
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.onDecrement,
    required this.onIncrement,
  });

  final int quantity;
  final VoidCallback onDecrement;
  final VoidCallback? onIncrement;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _StepperButton(icon: Icons.remove, onTap: onDecrement),
        SizedBox(
          width: 24,
          child: Text('$quantity', textAlign: TextAlign.center),
        ),
        _StepperButton(icon: Icons.add, onTap: onIncrement),
      ],
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.sm),
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Icon(
          icon,
          size: 16,
          color: onTap == null ? AppColors.textDisabled : null,
        ),
      ),
    );
  }
}
