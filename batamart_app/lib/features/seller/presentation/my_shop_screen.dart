import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_client.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../state/seller_providers.dart';
import '../../../core/utils/money.dart';

/// `GET /api/wallet` just for the Earnings tile — the full Wallet screen
/// (balance, transactions, withdraw) is Phase 8 scope; this is a minimal
/// stopgap read since the call itself is trivial.
final _shopEarningsProvider = FutureProvider.autoDispose<double>((ref) async {
  final response = await ApiClient.instance.get('/api/wallet');
  final wallet = response['wallet'] as Map<String, dynamic>?;
  return (wallet?['availableBalance'] as num?)?.toDouble() ?? 0;
});

/// Matches the collage's "My Shop" frame: Overview stat tiles + Manage
/// Products list. Reached from the Profile tab (per the mockup — My Shop
/// isn't a bottom-nav destination), same pattern as "Become a Seller".
class MyShopScreen extends ConsumerWidget {
  const MyShopScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    if (!(user?.isSeller ?? false)) {
      return const EmptyState(
        title: 'You\'re not a seller yet',
        message: 'Become a seller from your Profile to manage a shop.',
      );
    }

    final productsAsync = ref.watch(myProductsProvider);
    final salesAsync = ref.watch(salesProvider);
    final earningsAsync = ref.watch(_shopEarningsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Shop'),
        actions: [
          IconButton(
            tooltip: 'Add new product',
            icon: const Icon(LucideIcons.plus),
            onPressed: () => context.push(AppRoutes.sellProduct),
          ),
        ],
      ),
      body: productsAsync.when(
        data: (products) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(myProductsProvider);
            ref.invalidate(salesProvider);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Text(
                'Overview',
                style: AppTypography.display(size: 16, weight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _StatTile(
                      label: 'Products',
                      value: '${products.total}',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _StatTile(
                      label: 'Orders',
                      value: salesAsync.asData?.value.length.toString() ?? '—',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _StatTile(
                      label: 'Earnings',
                      value:
                          naira((earningsAsync.asData?.value ?? 0)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(
                'Manage Products',
                style: AppTypography.display(size: 16, weight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  LucideIcons.package,
                  color: AppColors.primary,
                ),
                title: const Text('All Products'),
                trailing: Text(
                  '${products.total} >',
                  style: TextStyle(color: context.palette.inkSecondary),
                ),
                onTap: () => context.push(AppRoutes.myShopProducts),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(LucideIcons.plus, color: AppColors.primary),
                title: const Text('Add New Product'),
                onTap: () => context.push(AppRoutes.sellProduct),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  LucideIcons.alertTriangle,
                  color: AppColors.warning,
                ),
                title: const Text('Inventory'),
                subtitle: const Text('Low stock alerts'),
                trailing: Text(
                  '${products.products.where((p) => p.quantity > 0 && p.quantity <= 5).length} >',
                  style: TextStyle(color: context.palette.inkSecondary),
                ),
                onTap: () => context.push(AppRoutes.myShopProducts),
              ),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load your shop.\n$error',
          onRetry: () => ref.invalidate(myProductsProvider),
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: context.palette.page,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: AppTypography.display(size: 16, weight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: context.palette.inkSecondary,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
