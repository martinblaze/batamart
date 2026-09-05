import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../auth/state/auth_controller.dart';
import '../../cart/state/cart_controller.dart';
import '../data/payments_repository.dart';
import '../../../core/utils/money.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/app_typography.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

final paymentsRepositoryProvider = Provider<PaymentsRepository>(
  (ref) => PaymentsRepository(),
);

/// Matches the collage's "Checkout" frame: delivery-address summary
/// (+Edit), a single order-notes field, an escrow explainer card, order
/// summary, "Pay with Flutterwave". The mockup shows one combined notes
/// field (not per-item) — applied to every cart item's `orderNote` at pay
/// time so it still round-trips through `payments/initialize`'s per-item
/// shape (BACKEND_REFERENCE.md §3.5).
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _noteController = TextEditingController();
  bool _deliverySuitabilityConfirmed = false;
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    if (!_deliverySuitabilityConfirmed) {
      Haptics.error();
      setState(
        () => _error =
            'Please confirm your delivery address is motorcycle-accessible.',
      );
      return;
    }
    // Fires on the tap rather than after the payment round trip: this is the
    // moment the user commits, and the webview takes over from here.
    Haptics.commit();
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final enabled = await ref
          .read(paymentsRepositoryProvider)
          .isPaymentEnabled();
      if (!enabled) {
        setState(
          () => _error = 'Payments are temporarily disabled. Try again later.',
        );
        return;
      }

      final cartController = ref.read(cartControllerProvider.notifier);
      final note = _noteController.text.trim();
      final items = ref.read(cartControllerProvider);
      for (var i = 0; i < items.length; i++) {
        await cartController.updateOrderNote(i, note);
        await cartController.setDeliveryAcknowledged(i, true);
      }

      final result = await ref
          .read(paymentsRepositoryProvider)
          .initialize(ref.read(cartControllerProvider));

      if (mounted) {
        context.push(
          AppRoutes.paymentWebview,
          extra: {
            'url': result.authorizationUrl,
            'reference': result.reference,
          },
        );
      }
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final items = ref.watch(cartControllerProvider);
    final quoteAsync = ref.watch(deliveryQuoteProvider);
    final subtotal = ref.read(cartControllerProvider.notifier).subtotal;
    final deliveryFee = quoteAsync.asData?.value.fee ?? 0;
    final total = subtotal + deliveryFee;

    final addressLines = [
      user?.hostelName,
      user?.roomNumber,
    ].whereType<String>().join(', ');

    return Scaffold(
      appBar: const BataAppBar(title: 'Checkout', showBack: true),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _CheckoutSection(
              icon: LucideIcons.mapPin,
              label: 'Delivery address',
              trailing: Pressable(
                onTap: () => context.push(AppRoutes.profileSetup),
                child: Text(
                  'EDIT',
                  style: AppTypography.label(size: 10, color: AppColors.primary),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    addressLines.isEmpty ? 'No address on file' : addressLines,
                    style: const TextStyle(fontWeight: FontWeight.w500, height: 1.45),
                  ),
                  if ((user?.landmark ?? '').isNotEmpty)
                    Text(
                      user!.landmark!,
                      style: TextStyle(color: context.palette.inkSecondary, height: 1.45),
                    ),
                ],
              ),
            ).enter(index: 0),
            const SizedBox(height: AppSpacing.lg),
            _CheckoutSection(
              icon: LucideIcons.messageSquare,
              label: 'Order notes (optional)',
              child: const SizedBox.shrink(),
            ).enter(index: 1),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _noteController,
              maxLength: 300,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Leave a note for the rider...',
              ),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _deliverySuitabilityConfirmed,
              onChanged: (v) =>
                  setState(() => _deliverySuitabilityConfirmed = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'My delivery address is accessible by motorcycle.',
                style: TextStyle(fontSize: 13),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: context.palette.card,
                border: Border.all(color: context.palette.hairline),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(LucideIcons.shieldCheck, color: AppColors.success, size: 18),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ESCROW PROTECTION',
                          style: AppTypography.label(
                            size: 10,
                            color: context.palette.ink,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          'Your payment is held safely and released to the seller only when you confirm delivery.',
                          style: TextStyle(
                            fontSize: 12,
                            height: 1.5,
                            color: context.palette.inkSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ).enter(index: 2),
            const SizedBox(height: AppSpacing.xl),
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: context.palette.card,
                border: Border.all(color: context.palette.hairline),
              ),
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'ORDER SUMMARY',
                      style: AppTypography.label(
                        size: 10,
                        color: context.palette.inkSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _SummaryRow(label: 'Subtotal', value: subtotal),
                  _SummaryRow(label: 'Delivery fee', value: deliveryFee),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                    child: Divider(height: 1, color: context.palette.hairline),
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'TOTAL',
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
              ),
            ).enter(index: 3),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(
              label: 'Pay with Flutterwave',
              icon: LucideIcons.lock,
              onPressed: items.isEmpty ? null : _pay,
              isLoading: _isSubmitting,
            ).enter(index: 4),
            const SizedBox(height: AppSpacing.md),
            Center(
              child: Pressable(
                onTap: () => context.pop(),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: Text(
                    'BACK TO CART',
                    style: AppTypography.label(
                      size: 10,
                      color: context.palette.inkSecondary,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
  });

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(fontWeight: FontWeight.w500, fontSize: 14);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.label(
              size: 10,
              color: context.palette.inkSecondary,
            ),
          ),
          Text(naira(value), style: style),
        ],
      ),
    );
  }
}


/// A labelled block on the checkout page. Mono kicker, optional trailing
/// action, hairline rule — so the page reads as a sequence of named steps
/// rather than a run of bold paragraphs.
class _CheckoutSection extends StatelessWidget {
  const _CheckoutSection({
    required this.icon,
    required this.label,
    required this.child,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: palette.inkMuted),
            const SizedBox(width: AppSpacing.sm),
            Text(
              label.toUpperCase(),
              style: AppTypography.label(size: 10, color: palette.inkSecondary),
            ),
            if (trailing != null) ...[const Spacer(), trailing!],
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
    );
  }
}
