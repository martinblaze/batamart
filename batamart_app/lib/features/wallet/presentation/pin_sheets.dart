import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../state/wallet_providers.dart';

/// Set/change a withdrawal PIN. `hasExistingPin` decides which of
/// `set-pin`'s three branches to call (BACKEND_REFERENCE.md §3.7) —
/// first-time set needs just the new PIN; changing needs `currentPin`.
Future<void> showSetPinSheet(
  BuildContext context,
  WidgetRef ref, {
  required bool hasExistingPin,
}) {
  final currentPinController = TextEditingController();
  final newPinController = TextEditingController();
  final formKey = GlobalKey<FormState>();
  String? error;

  return AppBottomSheet.show(
    context: context,
    title: hasExistingPin ? 'Change Withdrawal PIN' : 'Set Withdrawal PIN',
    child: StatefulBuilder(
      builder: (context, setState) {
        return Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (hasExistingPin) ...[
                AppTextField(
                  controller: currentPinController,
                  label: 'Current PIN',
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              AppTextField(
                controller: newPinController,
                label: 'New 6-digit PIN',
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
                label: 'Save PIN',
                onPressed: () async {
                  if (newPinController.text.trim().length != 6) {
                    setState(() => error = 'Enter a 6-digit PIN.');
                    return;
                  }
                  try {
                    await ref
                        .read(walletRepositoryProvider)
                        .setPin(
                          pin: newPinController.text.trim(),
                          currentPin: hasExistingPin
                              ? currentPinController.text.trim()
                              : null,
                        );
                    if (context.mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('PIN saved.')),
                      );
                    }
                  } catch (e) {
                    setState(() => error = '$e');
                  }
                },
              ),
            ],
          ),
        );
      },
    ),
  );
}

/// "Forgot PIN": `reset-pin` emails an OTP, then `set-pin` with that
/// `otpCode` completes it (BACKEND_REFERENCE.md §3.7).
Future<void> showForgotPinSheet(BuildContext context, WidgetRef ref) {
  final otpController = TextEditingController();
  final newPinController = TextEditingController();
  bool otpSent = false;
  String? error;

  return AppBottomSheet.show(
    context: context,
    title: 'Reset Withdrawal PIN',
    child: StatefulBuilder(
      builder: (context, setState) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!otpSent)
              PrimaryButton(
                label: 'Send Reset Code',
                onPressed: () async {
                  try {
                    await ref
                        .read(walletRepositoryProvider)
                        .requestPinResetOtp();
                    setState(() => otpSent = true);
                  } catch (e) {
                    setState(() => error = '$e');
                  }
                },
              )
            else ...[
              AppTextField(
                controller: otpController,
                label: 'Code sent to your email',
                keyboardType: TextInputType.number,
                maxLength: 6,
              ),
              const SizedBox(height: AppSpacing.sm),
              AppTextField(
                controller: newPinController,
                label: 'New 6-digit PIN',
                obscureText: true,
                keyboardType: TextInputType.number,
                maxLength: 6,
              ),
              const SizedBox(height: AppSpacing.md),
              PrimaryButton(
                label: 'Reset PIN',
                onPressed: () async {
                  try {
                    await ref
                        .read(walletRepositoryProvider)
                        .setPin(
                          pin: newPinController.text.trim(),
                          otpCode: otpController.text.trim(),
                        );
                    if (context.mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('PIN reset.')),
                      );
                    }
                  } catch (e) {
                    setState(() => error = '$e');
                  }
                },
              ),
            ],
            if (error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(error!, style: const TextStyle(color: AppColors.danger)),
            ],
          ],
        );
      },
    ),
  );
}
