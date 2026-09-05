import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../data/wallet_models.dart';
import '../state/wallet_providers.dart';
import 'pin_sheets.dart';
import 'withdraw_sheet.dart';

/// Standalone push destination wrapping [WalletBody] with its own app bar
/// — used from Profile. `RiderHomeShell`'s Earnings tab embeds
/// [WalletBody] directly under its own shell app bar instead, to avoid
/// nesting two app bars.
class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isRider = ref.watch(authControllerProvider).user?.isRider ?? false;
    return Scaffold(
      backgroundColor: context.palette.page,
      appBar: BataAppBar(
        title: isRider ? 'Earnings' : 'Wallet',
        showBack: true,
      ),
      body: const WalletBody(),
    );
  }
}

/// Matches the collage's "Wallet" frame: gradient balance card, 4 quick
/// actions (Add Money/Transactions/Withdraw/PIN), recent transactions.
/// Same screen/data source for all 3 roles — RIDER gets an "Earnings"
/// label swap per BACKEND_REFERENCE.md §3.7, not a different screen.
class WalletBody extends ConsumerWidget {
  const WalletBody({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final isRider = user?.isRider ?? false;
    final isSeller = user?.isSeller ?? false;
    final walletAsync = ref.watch(walletProvider);
    final transactionsAsync = ref.watch(walletTransactionsProvider);

    final balanceLabel = isRider
        ? 'Available Earnings'
        : 'Wallet Balance';
    final pendingLabel = isSeller || isRider ? 'In Escrow' : 'Pending';

    return walletAsync.when(
      data: (wallet) => RefreshIndicator(
        onRefresh: () => ref.refresh(walletProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            _BalanceCard(
              balance: wallet.availableBalance,
              pending: wallet.pendingBalance,
              label: balanceLabel,
              pendingLabel: pendingLabel,
              onWithdraw: () => showWithdrawSheet(context, ref),
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              decoration: BoxDecoration(
                color: context.palette.card,
                borderRadius: BorderRadius.circular(AppRadii.lg),
                border: Border.all(color: context.palette.hairline),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _QuickAction(
                    icon: LucideIcons.plus,
                    label: 'Add Money',
                    onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('No top-up endpoint documented yet.'),
                      ),
                    ),
                  ),
                  _QuickAction(
                    icon: LucideIcons.history,
                    label: 'Transactions',
                    onTap: () => context.push(AppRoutes.walletTransactions),
                  ),
                  _QuickAction(
                    icon: LucideIcons.banknote,
                    label: 'Withdraw',
                    onTap: () => showWithdrawSheet(context, ref),
                  ),
                  _QuickAction(
                    icon: LucideIcons.shield,
                    label: 'PIN',
                    onTap: () => _showPinMenu(
                      context,
                      ref,
                      user?.hasWithdrawalPin ?? false,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Recent Transactions',
                  style: AppTypography.display(size: 15, weight: FontWeight.w700),
                ),
                TextButton(
                  onPressed: () => context.push(AppRoutes.walletTransactions),
                  child: const Text('View All'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            transactionsAsync.when(
              data: (transactions) {
                if (transactions.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                    child: EmptyState(
                      icon: LucideIcons.receipt,
                      title: 'No transactions yet',
                      message: 'Your wallet activity will show up here.',
                    ),
                  );
                }
                final shown = transactions.take(5).toList();
                return Container(
                  decoration: BoxDecoration(
                    color: context.palette.card,
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    border: Border.all(color: context.palette.hairline),
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < shown.length; i++) ...[
                        TransactionRow(transaction: shown[i]),
                        if (i != shown.length - 1)
                          const Divider(height: 1, indent: AppSpacing.md, endIndent: AppSpacing.md),
                      ],
                    ],
                  ),
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, stackTrace) =>
                  Text('Could not load transactions.\n$error'),
            ),
          ],
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) => ErrorState(
        message: 'Could not load your wallet.\n$error',
        onRetry: () => ref.invalidate(walletProvider),
      ),
    );
  }

  void _showPinMenu(BuildContext context, WidgetRef ref, bool hasExistingPin) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(hasExistingPin ? 'Change PIN' : 'Set PIN'),
              onTap: () {
                Navigator.of(context).pop();
                showSetPinSheet(context, ref, hasExistingPin: hasExistingPin);
              },
            ),
            if (hasExistingPin)
              ListTile(
                title: const Text('Forgot PIN'),
                onTap: () {
                  Navigator.of(context).pop();
                  showForgotPinSheet(context, ref);
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({
    required this.balance,
    required this.pending,
    required this.label,
    required this.pendingLabel,
    required this.onWithdraw,
  });

  final double balance;
  final double pending;
  final String label;
  final String pendingLabel;
  final VoidCallback onWithdraw;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: context.palette.slab,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Decorative translucent circles for visual weight, matching the
          // web wallet hero card treatment.
          Positioned(
            top: -30,
            right: -30,
            child: _decorCircle(90),
          ),
          Positioned(
            bottom: -40,
            left: -20,
            child: _decorCircle(70),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white),
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                    ),
                    onPressed: onWithdraw,
                    child: const Text('Withdraw'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '₦${NumberFormat('#,##0.00').format(balance)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (pending > 0)
                Row(
                  children: [
                    const Icon(LucideIcons.lock, size: 14, color: Colors.white70),
                    const SizedBox(width: 6),
                    Text(
                      '$pendingLabel: ₦${NumberFormat('#,##0.00').format(pending)}',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _decorCircle(double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.08),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
              child: Icon(icon, color: AppColors.primary),
            ),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

/// Icon/color/label per `TransactionType` (BACKEND_REFERENCE.md §2 enum:
/// CREDIT/DEBIT/ESCROW/WITHDRAWAL/REFERRAL_REWARD) — every type gets a
/// visually distinct treatment instead of a flat credit/debit split, so an
/// escrow hold reads differently from a plain credit and a referral payout
/// reads differently from a withdrawal.
class _TxTypeMeta {
  const _TxTypeMeta({
    required this.icon,
    required this.color,
    required this.label,
    required this.isCredit,
  });

  final IconData icon;
  final Color color;
  final String label;
  final bool isCredit;

  static _TxTypeMeta of(String type) {
    switch (type) {
      case 'CREDIT':
        return const _TxTypeMeta(
          icon: LucideIcons.arrowDownLeft,
          color: AppColors.success,
          label: 'Payment Received',
          isCredit: true,
        );
      case 'ESCROW':
        return const _TxTypeMeta(
          icon: LucideIcons.lock,
          color: AppColors.warning,
          label: 'Held in Escrow',
          isCredit: true,
        );
      case 'WITHDRAWAL':
        return const _TxTypeMeta(
          icon: LucideIcons.banknote,
          color: AppColors.danger,
          label: 'Withdrawal',
          isCredit: false,
        );
      case 'REFERRAL_REWARD':
        return const _TxTypeMeta(
          icon: LucideIcons.gift,
          color: AppColors.primary,
          label: 'Referral Reward',
          isCredit: true,
        );
      case 'DEBIT':
      default:
        return const _TxTypeMeta(
          icon: LucideIcons.arrowUpRight,
          color: AppColors.danger,
          label: 'Debit',
          isCredit: false,
        );
    }
  }
}

class TransactionRow extends StatelessWidget {
  const TransactionRow({super.key, required this.transaction});

  final WalletTransaction transaction;

  @override
  Widget build(BuildContext context) {
    final meta = _TxTypeMeta.of(transaction.type);

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: meta.color.withValues(alpha: 0.12),
            child: Icon(meta.icon, size: 17, color: meta.color),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  transaction.description?.isNotEmpty == true
                      ? transaction.description!
                      : meta.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: meta.color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                      ),
                      child: Text(
                        meta.label,
                        style: TextStyle(
                          color: meta.color,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (transaction.createdAt != null) ...[
                      const SizedBox(width: 6),
                      Text(
                        DateFormat.yMMMd().format(transaction.createdAt!),
                        style: TextStyle(
                          color: context.palette.inkSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            '${meta.isCredit ? '+' : '-'}₦${transaction.amount.abs().toStringAsFixed(0)}',
            style: TextStyle(color: meta.color, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
