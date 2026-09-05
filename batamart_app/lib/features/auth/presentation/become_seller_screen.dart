import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../wallet/presentation/pin_sheets.dart';
import '../state/auth_controller.dart';

/// Onboarding for a BUYER to upgrade to SELLER — benefits/requirements
/// explainer, then `POST /api/auth/become-seller` (one-time, one-way;
/// blocked for RIDER/ADMIN — BACKEND_REFERENCE.md §3.1). The web's
/// post-success chain is List first product / Set withdrawal PIN / Go to
/// marketplace.
class BecomeSellerScreen extends ConsumerStatefulWidget {
  const BecomeSellerScreen({super.key});

  @override
  ConsumerState<BecomeSellerScreen> createState() => _BecomeSellerScreenState();
}

class _BecomeSellerScreenState extends ConsumerState<BecomeSellerScreen> {
  bool _isSubmitting = false;
  bool _didSucceed = false;
  String? _error;

  Future<void> _upgrade() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).becomeSeller();
      setState(() => _didSucceed = true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BataAppBar(title: 'Become a Seller', showBack: true),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: _didSucceed
              ? _buildSuccess(context)
              : _buildExplainer(context),
        ),
      ),
    );
  }

  Widget _buildExplainer(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Start selling on BataMart',
          style: AppTypography.display(size: 22, weight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.lg),
        const _BenefitRow(
          icon: LucideIcons.store,
          text: 'List unlimited products to campus buyers',
        ),
        const _BenefitRow(
          icon: LucideIcons.wallet,
          text: 'Get paid into your BataMart wallet, escrow-protected',
        ),
        const _BenefitRow(
          icon: LucideIcons.shield,
          text: 'A withdrawal PIN keeps your payouts secure',
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          'A 5% platform fee applies to each sale. You can switch between buyer and seller view '
          'any time after upgrading.',
          style: TextStyle(color: context.palette.inkSecondary),
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const Spacer(),
        PrimaryButton(
          label: 'Become a Seller',
          onPressed: _upgrade,
          isLoading: _isSubmitting,
        ),
      ],
    );
  }

  Widget _buildSuccess(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(LucideIcons.badgeCheck, color: AppColors.success, size: 56),
        const SizedBox(height: AppSpacing.lg),
        Text(
          "You're now a seller!",
          style: AppTypography.display(size: 22, weight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Set up your wallet withdrawal PIN and list your first product to start selling.',
          style: TextStyle(color: context.palette.inkSecondary),
        ),
        const Spacer(),
        SecondaryButton(
          label: 'Set Withdrawal PIN',
          onPressed: () =>
              showSetPinSheet(context, ref, hasExistingPin: false),
        ),
        const SizedBox(height: AppSpacing.sm),
        SecondaryButton(
          label: 'List First Product',
          onPressed: () => context.push(AppRoutes.sellProduct),
        ),
        const SizedBox(height: AppSpacing.sm),
        PrimaryButton(
          label: 'Go to Marketplace',
          onPressed: () => context.go(AppRoutes.home),
        ),
      ],
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
