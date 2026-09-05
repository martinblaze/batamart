import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/referrals_repository.dart';
import '../../../core/utils/money.dart';

final referralsRepositoryProvider = Provider<ReferralsRepository>(
  (ref) => ReferralsRepository(),
);

final referralInfoProvider = FutureProvider.autoDispose<ReferralInfo>((ref) {
  return ref.watch(referralsRepositoryProvider).fetchReferralInfo();
});

/// Matches the collage's "Referrals" frame: code + copy, "Share Code"
/// (native share sheet, not a web share-button equivalent per BUILD_PLAN
/// Phase 8 scope), stats, recent referrals. `GET /api/referrals`
/// (BACKEND_REFERENCE.md §3.11) is read-only — rewards are credited
/// server-side elsewhere.
class ReferralsScreen extends ConsumerWidget {
  const ReferralsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final infoAsync = ref.watch(referralInfoProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Referrals', showBack: true),
      body: infoAsync.when(
        data: (info) => RefreshIndicator(
          onRefresh: () => ref.refresh(referralInfoProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Text(
                'Your Referral Code',
                style: TextStyle(color: context.palette.inkSecondary),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Text(
                    info.referralCode,
                    style: AppTypography.display(size: 24, weight: FontWeight.w700),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  IconButton(
                    tooltip: 'Copy code',
                    icon: const Icon(Icons.copy, size: 18),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: info.referralCode));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Code copied.')),
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Share and earn ₦500 for each friend',
                style: TextStyle(color: context.palette.inkSecondary),
              ),
              const SizedBox(height: AppSpacing.lg),
              PrimaryButton(
                label: 'Share Code',
                onPressed: () => SharePlus.instance.share(
                  ShareParams(
                    text:
                        'Join BataMart with my code ${info.referralCode}: ${info.referralLink}',
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              const Text(
                'Referrals Stats',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _StatBox(
                      label: 'Total Referrals',
                      value: '${info.totalReferrals}',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _StatBox(
                      label: 'Total Earned',
                      value: naira(info.totalEarnings),
                      valueColor: AppColors.success,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              const Text(
                'Recent Referrals',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final referral in info.referrals.take(10))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(referral['name']?.toString() ?? ''),
                  subtitle: const Text('Joined'),
                  trailing: const Text(
                    '+₦500',
                    style: TextStyle(color: AppColors.success),
                  ),
                ),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load your referral info.\n$error',
          onRetry: () => ref.invalidate(referralInfoProvider),
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.palette.page,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: valueColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: context.palette.inkSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
