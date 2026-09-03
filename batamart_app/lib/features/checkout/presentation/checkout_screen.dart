import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../auth/state/auth_controller.dart';
import '../../cart/state/cart_controller.dart';
import '../data/payments_repository.dart';

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
      setState(
        () => _error =
            'Please confirm your delivery address is motorcycle-accessible.',
      );
      return;
    }
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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Delivery Address',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                TextButton(
                  onPressed: () => context.push(AppRoutes.profileSetup),
                  child: const Text('Edit'),
                ),
              ],
            ),
            Text(addressLines.isEmpty ? 'No address on file' : addressLines),
            Text(
              user?.landmark ?? '',
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xl),
            const Text(
              'Order Notes (Optional)',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
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
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, color: AppColors.info, size: 20),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Escrow Protection\nYour payment is held safely and released to the seller '
                      'only when you confirm delivery.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            const Text(
              'Order Summary',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.sm),
            _SummaryRow(label: 'Subtotal', value: subtotal),
            _SummaryRow(label: 'Delivery Fee', value: deliveryFee),
            const Divider(),
            _SummaryRow(label: 'Total', value: total, isBold: true),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(
              label: 'Pay with Flutterwave',
              onPressed: items.isEmpty ? null : _pay,
              isLoading: _isSubmitting,
            ),
            const SizedBox(height: AppSpacing.sm),
            Center(
              child: TextButton(
                onPressed: () => context.pop(),
                child: const Text('Back to Cart'),
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
    this.isBold = false,
  });

  final String label;
  final double value;
  final bool isBold;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: isBold ? FontWeight.w800 : FontWeight.w400,
      fontSize: isBold ? 16 : 14,
      color: isBold ? null : AppColors.textSecondary,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text('₦${value.toStringAsFixed(0)}', style: style),
        ],
      ),
    );
  }
}
