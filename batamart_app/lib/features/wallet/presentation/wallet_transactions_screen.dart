import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../state/wallet_providers.dart';
import 'wallet_screen.dart' show TransactionRow;

/// `GET /api/wallet/transactions`, full list ("View All" from the Wallet
/// screen).
class WalletTransactionsScreen extends ConsumerWidget {
  const WalletTransactionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transactionsAsync = ref.watch(walletTransactionsProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Transactions', showBack: true),
      body: transactionsAsync.when(
        data: (transactions) {
          if (transactions.isEmpty) {
            return const EmptyState(
              icon: LucideIcons.receipt,
              title: 'No transactions yet',
              message: 'Your wallet activity will show up here.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.lg),
            itemCount: transactions.length,
            separatorBuilder: (context, index) => const Divider(height: 1),
            itemBuilder: (context, index) =>
                TransactionRow(transaction: transactions[index]),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load transactions.\n$error',
          onRetry: () => ref.invalidate(walletTransactionsProvider),
        ),
      ),
    );
  }
}
