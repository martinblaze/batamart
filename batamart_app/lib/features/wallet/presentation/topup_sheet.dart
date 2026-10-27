import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../state/wallet_providers.dart';

/// Add money to the wallet through Flutterwave. The payment page opens in the
/// same WebView used for checkout; when it finishes the wallet reloads.
void showTopUpSheet(BuildContext context, WidgetRef ref) {
  AppBottomSheet.show<void>(
    context: context,
    title: 'Add money',
    child: _TopUpForm(parentContext: context, parentRef: ref),
  );
}

class _TopUpForm extends ConsumerStatefulWidget {
  const _TopUpForm({required this.parentContext, required this.parentRef});

  final BuildContext parentContext;
  final WidgetRef parentRef;

  @override
  ConsumerState<_TopUpForm> createState() => _TopUpFormState();
}

class _TopUpFormState extends ConsumerState<_TopUpForm> {
  final _controller = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = int.tryParse(_controller.text.trim());
    if (amount == null || amount < 100) {
      setState(() => _error = 'Enter a whole amount of at least ₦100.');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final url = await ref.read(walletRepositoryProvider).startTopUp(amount);
      if (!mounted) return;
      final parent = widget.parentContext;
      final parentRef = widget.parentRef;
      Navigator.of(context).pop();
      if (!parent.mounted) return;
      final ok = await parent.push<bool>(
        AppRoutes.paymentWebview,
        extra: {'url': url, 'reference': ''},
      );
      parentRef.invalidate(walletProvider);
      if (parent.mounted && ok != null) {
        ScaffoldMessenger.of(parent).showSnackBar(
          SnackBar(
            content: Text(
              ok
                  ? 'Top-up received. Your balance is updated.'
                  : 'The top-up did not go through. You were not charged.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(
          controller: _controller,
          label: 'Amount (₦)',
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          children: [
            for (final v in const [1000, 2000, 5000, 10000])
              ActionChip(
                label: Text('₦$v'),
                onPressed: () => setState(() => _controller.text = '$v'),
              ),
          ],
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(
          label: 'Continue to payment',
          onPressed: _submit,
          isLoading: _isSubmitting,
        ),
      ],
    );
  }
}
