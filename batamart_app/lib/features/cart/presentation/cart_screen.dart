import 'package:flutter/material.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../auth/state/auth_controller.dart';
import '../data/cart_models.dart';
import '../state/cart_controller.dart';
import '../../../core/utils/money.dart';
import '../../../core/motion/motion.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
      return EmptyState(
        icon: LucideIcons.shoppingBag,
        title: 'Your cart is empty',
        message: 'Browse what students around you are selling and add anything you want to keep.',
        actionLabel: 'Start shopping',
        onActionTap: () => context.go(AppRoutes.home),
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
        for (final (i, entry) in bySeller.entries.indexed)
          _SellerGroup(items: entry.value).enter(index: i),
        const SizedBox(height: AppSpacing.sm),

        // Delivery address — a named value, not a loose line of text.
        _CartPanel(
          children: [
            Row(
              children: [
                Icon(LucideIcons.mapPin, size: 14, color: context.palette.inkMuted),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'DELIVERING TO',
                  style: AppTypography.label(
                    size: 10,
                    color: context.palette.inkSecondary,
                  ),
                ),
                const Spacer(),
                Pressable(
                  onTap: () => context.push(AppRoutes.profileSetup),
                  child: Text(
                    'CHANGE',
                    style: AppTypography.label(
                      size: 10,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              deliveryAddress.isEmpty
                  ? 'No delivery address on file'
                  : deliveryAddress,
              style: const TextStyle(fontWeight: FontWeight.w500, height: 1.45),
            ),
          ],
        ).enter(index: bySeller.length),

        const SizedBox(height: AppSpacing.md),

        // Order summary. The total counts up, so a delivery quote resolving
        // reads as the figure moving rather than the label being swapped.
        _CartPanel(
          children: [
            _SummaryRow(label: 'Subtotal', value: naira(subtotal)),
            const SizedBox(height: AppSpacing.sm),
            _SummaryRow(
              label: 'Delivery fee',
              value: quoteAsync.isLoading ? 'Calculating…' : naira(deliveryFee),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Divider(height: 1, color: context.palette.hairline),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'TOTAL · ${ref.read(cartControllerProvider.notifier).totalItems} ITEMS',
                  style: AppTypography.label(
                    size: 10,
                    color: context.palette.ink,
                  ),
                ),
                CountUp(
                  value: total,
                  format: (v) => naira(v),
                  style: AppTypography.figure(
                    size: 26,
                    color: context.palette.ink,
                  ),
                ),
              ],
            ),
          ],
        ).enter(index: bySeller.length + 1),

        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(
          label: 'Secure checkout',
          icon: LucideIcons.lock,
          onPressed: () => context.push(AppRoutes.checkout),
        ).enter(index: bySeller.length + 2),
        const SizedBox(height: AppSpacing.sm),
        Center(
          child: Text(
            'ESCROW PROTECTED · RELEASED ON DELIVERY',
            style: AppTypography.label(
              size: 9,
              color: context.palette.inkMuted,
            ),
          ),
        ).enter(index: bySeller.length + 3),
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
                          naira(item.price),
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
                ? () {
                    Haptics.change();
                    controller.updateQuantity(index, item.quantity - 1);
                  }
                : () {
                    // Dropping below 1 removes the line entirely — a bigger
                    // change than a decrement, so it is not silent.
                    Haptics.change();
                    controller.removeAt(index);
                  },
            onIncrement: item.quantity < item.maxQuantity
                ? () {
                    Haptics.change();
                    controller.updateQuantity(index, item.quantity + 1);
                  }
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
          border: Border.all(color: context.palette.hairline),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Icon(
          icon,
          size: 16,
          color: onTap == null ? context.palette.inkMuted : null,
        ),
      ),
    );
  }
}


/// Hairline panel used by the cart's address and summary blocks. Keeps the
/// two reading as one system rather than two loose stacks of text.
class _CartPanel extends StatelessWidget {
  const _CartPanel({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.card,
        border: Border.all(color: palette.hairline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }
}

/// One label/figure pair in the order summary.
class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label.toUpperCase(),
          style: AppTypography.label(size: 10, color: palette.inkSecondary),
        ),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
      ],
    );
  }
}
