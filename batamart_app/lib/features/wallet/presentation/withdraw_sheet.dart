import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../data/nigerian_banks.dart';
import '../state/wallet_providers.dart';

/// `POST /api/wallet/withdraw` (BACKEND_REFERENCE.md §3.7) — ₦1,000-500,000,
/// PIN required, plus an optional biometric confirmation layered on top
/// client-side (the backend only knows about the PIN; biometrics are a
/// device-local gate before we even send the PIN).
Future<void> showWithdrawSheet(BuildContext context, WidgetRef ref) {
  final amountController = TextEditingController();
  final accountNumberController = TextEditingController();
  final accountNameController = TextEditingController();
  final pinController = TextEditingController();
  NigerianBank? selectedBank;
  bool isSubmitting = false;
  String? error;

  return AppBottomSheet.show(
    context: context,
    title: 'Withdraw',
    child: StatefulBuilder(
      builder: (context, setState) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(
              controller: amountController,
              label: 'Amount (₦1,000 - ₦500,000)',
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<NigerianBank>(
              initialValue: selectedBank,
              decoration: const InputDecoration(labelText: 'Bank'),
              items: kNigerianBanks
                  .map((b) => DropdownMenuItem(value: b, child: Text(b.name)))
                  .toList(),
              onChanged: (b) => setState(() => selectedBank = b),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(
              controller: accountNumberController,
              label: 'Account Number',
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(
              controller: accountNameController,
              label: 'Account Name',
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(
              controller: pinController,
              label: 'Withdrawal PIN',
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 6,
            ),
            if (error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: AppSpacing.md),
            PrimaryButton(
              label: 'Withdraw',
              isLoading: isSubmitting,
              onPressed: () async {
                final amount = int.tryParse(amountController.text.trim());
                if (amount == null || amount < 1000 || amount > 500000) {
                  setState(
                    () =>
                        error = 'Enter an amount between ₦1,000 and ₦500,000.',
                  );
                  return;
                }
                if (selectedBank == null ||
                    accountNumberController.text.trim().isEmpty) {
                  setState(
                    () => error = 'Select a bank and enter the account number.',
                  );
                  return;
                }
                if (pinController.text.trim().length != 6) {
                  setState(() => error = 'Enter your 6-digit PIN.');
                  return;
                }

                final biometrics = ref.read(biometricServiceProvider);
                if (await biometrics.isAvailable()) {
                  final confirmed = await biometrics.authenticate(
                    'Confirm withdrawal',
                  );
                  if (!confirmed) {
                    setState(() => error = 'Biometric confirmation failed.');
                    return;
                  }
                }

                setState(() {
                  isSubmitting = true;
                  error = null;
                });
                try {
                  await ref
                      .read(walletRepositoryProvider)
                      .withdraw(
                        amount: amount,
                        bankCode: selectedBank!.code,
                        accountNumber: accountNumberController.text.trim(),
                        accountName: accountNameController.text.trim(),
                        pin: pinController.text.trim(),
                      );
                  ref.invalidate(walletProvider);
                  ref.invalidate(walletTransactionsProvider);
                  if (context.mounted) {
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Withdrawal initiated.')),
                    );
                  }
                } catch (e) {
                  setState(() {
                    error = '$e';
                    isSubmitting = false;
                  });
                }
              },
            ),
          ],
        );
      },
    ),
  );
}
