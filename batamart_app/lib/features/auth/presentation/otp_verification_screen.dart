import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../state/auth_controller.dart';

/// Signup-flow OTP step (BACKEND_REFERENCE.md §3.1 `verify-otp`, no `name`
/// in the body). Pushed from [SignupScreen] with the target email; pops
/// with the resulting `otpSessionToken` on success, or `null` if the user
/// backs out.
class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<OtpVerificationScreen> createState() =>
      _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _codeController = TextEditingController();
  bool _isVerifying = false;
  bool _isResending = false;
  String? _error;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    setState(() {
      _isVerifying = true;
      _error = null;
    });
    try {
      final token = await ref
          .read(authControllerProvider.notifier)
          .verifySignupOtp(
            email: widget.email,
            code: _codeController.text.trim(),
          );
      if (mounted) Navigator.of(context).pop(token);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _isResending = true);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .sendSignupOtp(email: widget.email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Code resent — check your email.')),
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BataAppBar(title: 'Verify your email', showBack: true),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'We sent a 6-digit code to ${widget.email}. It expires in 10 minutes.',
                style: TextStyle(color: context.palette.inkSecondary),
              ),
              const SizedBox(height: AppSpacing.xl),
              AppTextField(
                controller: _codeController,
                label: 'Verification code',
                keyboardType: TextInputType.number,
                maxLength: 6,
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.md),
              PrimaryButton(
                label: 'Verify',
                onPressed: _verify,
                isLoading: _isVerifying,
              ),
              const SizedBox(height: AppSpacing.md),
              Center(
                child: TextButton(
                  onPressed: _isResending ? null : _resend,
                  child: Text(_isResending ? 'Resending...' : 'Resend code'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
