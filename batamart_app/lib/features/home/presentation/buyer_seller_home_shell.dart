import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/trust_badge.dart';
import '../../../core/widgets/nav/buyer_seller_nav_shell.dart';
import '../../auth/presentation/edit_profile_sheet.dart';
import '../../auth/state/auth_controller.dart';
import '../../cart/presentation/cart_screen.dart';
import '../../cart/state/cart_controller.dart';
import '../../marketplace/presentation/deals_screen.dart';
import '../../marketplace/presentation/marketplace_home_screen.dart';
import '../../marketplace/state/products_providers.dart';
import '../../orders/presentation/orders_screen.dart';

/// Landing shell for BUYER/SELLER after login/onboarding. Home/Deals/Cart/
/// Orders tabs are all real screens as of Phase 6.
class BuyerSellerHomeShell extends ConsumerStatefulWidget {
  const BuyerSellerHomeShell({super.key, this.initialTab});

  /// Lets a caller (e.g. the post-payment "Go to Orders" dialog) land
  /// directly on a specific tab instead of always defaulting to Home.
  final BuyerSellerNavTab? initialTab;

  @override
  ConsumerState<BuyerSellerHomeShell> createState() =>
      _BuyerSellerHomeShellState();
}

class _BuyerSellerHomeShellState extends ConsumerState<BuyerSellerHomeShell> {
  late BuyerSellerNavTab _tab = widget.initialTab ?? BuyerSellerNavTab.home;

  static const _titles = {
    BuyerSellerNavTab.home: 'Home',
    BuyerSellerNavTab.deals: 'Deals',
    BuyerSellerNavTab.cart: 'Cart',
    BuyerSellerNavTab.orders: 'Orders',
    BuyerSellerNavTab.profile: 'Profile',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_titles[_tab]!)),
      body: _buildBody(),
      floatingActionButton: _tab == BuyerSellerNavTab.home
          ? Consumer(
              builder: (context, ref, _) {
                final user = ref.watch(authControllerProvider).user;
                return FloatingActionButton(
                  tooltip: 'Sell a product',
                  onPressed: () => context.push(
                    (user?.isSeller ?? false)
                        ? AppRoutes.sellProduct
                        : AppRoutes.becomeSeller,
                  ),
                  child: const Icon(LucideIcons.plus),
                );
              },
            )
          : null,
      // Cart-count watch lives in this Consumer (not this widget's own
      // build) so a cart mutation only rebuilds the nav badge, not
      // whichever full-screen tab body is currently active.
      bottomNavigationBar: Consumer(
        builder: (context, ref, _) {
          final cartItems = ref.watch(cartControllerProvider);
          final cartCount = cartItems.fold<int>(
            0,
            (sum, item) => sum + item.quantity,
          );
          return BuyerSellerBottomNav(
            currentTab: _tab,
            cartItemCount: cartCount,
            onTabSelected: (tab) => setState(() => _tab = tab),
          );
        },
      ),
    );
  }

  Widget _buildBody() {
    switch (_tab) {
      case BuyerSellerNavTab.home:
        return Consumer(
          builder: (context, ref, _) => MarketplaceHomeScreen(
            onCategorySelected: (category) {
              ref.read(dealsQueryProvider.notifier).state = ref
                  .read(dealsQueryProvider)
                  .copyWith(
                    category: category.label,
                    categoryKey: category.key,
                    page: 1,
                  );
              setState(() => _tab = BuyerSellerNavTab.deals);
            },
          ),
        );
      case BuyerSellerNavTab.deals:
        return const DealsScreen();
      case BuyerSellerNavTab.cart:
        return const CartScreen();
      case BuyerSellerNavTab.profile:
        return const _ProfilePlaceholder();
      case BuyerSellerNavTab.orders:
        return const OrdersScreen();
    }
  }
}

class _ProfilePlaceholder extends ConsumerWidget {
  const _ProfilePlaceholder();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final initial = (user?.name.isNotEmpty ?? false)
        ? user!.name[0].toUpperCase()
        : '?';

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              backgroundImage: user?.profilePhoto != null
                  ? NetworkImage(user!.profilePhoto!)
                  : null,
              child: user?.profilePhoto == null
                  ? Text(
                      initial,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 22,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          user?.name ?? '',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (user != null) TrustBadge(level: user.trustLevel),
                    ],
                  ),
                  Text(
                    user?.email ?? user?.phone ?? '',
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Edit Profile',
              icon: const Icon(LucideIcons.pencil),
              onPressed: () => showEditProfileSheet(context, ref),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        ListTile(
          leading: const Icon(LucideIcons.wallet),
          title: const Text('Wallet'),
          trailing: const Icon(LucideIcons.chevronRight, size: 18),
          onTap: () => context.push(AppRoutes.wallet),
        ),
        ListTile(
          leading: const Icon(LucideIcons.gift),
          title: const Text('Referrals'),
          trailing: const Icon(LucideIcons.chevronRight, size: 18),
          onTap: () => context.push(AppRoutes.referrals),
        ),
        ListTile(
          leading: const Icon(LucideIcons.bell),
          title: const Text('Notifications'),
          trailing: const Icon(LucideIcons.chevronRight, size: 18),
          onTap: () => context.push(AppRoutes.notifications),
        ),
        ListTile(
          leading: const Icon(LucideIcons.settings),
          title: const Text('Settings'),
          trailing: const Icon(LucideIcons.chevronRight, size: 18),
          onTap: () => context.push(AppRoutes.settings),
        ),
        if (user?.isBuyer ?? false)
          ListTile(
            leading: const Icon(LucideIcons.store),
            title: const Text('Become a Seller'),
            trailing: const Icon(LucideIcons.chevronRight, size: 18),
            onTap: () => context.push(AppRoutes.becomeSeller),
          ),
        if (user?.isSeller ?? false) ...[
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            secondary: const Icon(LucideIcons.repeat),
            title: const Text('Seller Mode'),
            value: user!.isSellerMode,
            onChanged: (v) => ref
                .read(authControllerProvider.notifier)
                .toggleSellerMode(isSellerMode: v),
          ),
          ListTile(
            leading: const Icon(LucideIcons.store),
            title: const Text('My Shop'),
            trailing: const Icon(LucideIcons.chevronRight, size: 18),
            onTap: () => context.push(AppRoutes.myShop),
          ),
          ListTile(
            leading: const Icon(LucideIcons.clipboardList),
            title: const Text('Sales'),
            trailing: const Icon(LucideIcons.chevronRight, size: 18),
            onTap: () => context.push(AppRoutes.sales),
          ),
        ],
        ListTile(
          leading: const Icon(LucideIcons.scale),
          title: const Text('Disputes'),
          trailing: const Icon(LucideIcons.chevronRight, size: 18),
          onTap: () => context.push(AppRoutes.disputes),
        ),
        ListTile(
          leading: const Icon(LucideIcons.users),
          title: const Text('Sellers'),
          trailing: const Icon(LucideIcons.chevronRight, size: 18),
          onTap: () => context.push(AppRoutes.sellerDirectory),
        ),
        ListTile(
          leading: const Icon(LucideIcons.trendingUp),
          title: const Text('Most Bought'),
          trailing: const Icon(LucideIcons.chevronRight, size: 18),
          onTap: () => context.push(AppRoutes.mostBought),
        ),
        ListTile(
          leading: const Icon(LucideIcons.logOut, color: AppColors.danger),
          title: const Text(
            'Logout',
            style: TextStyle(color: AppColors.danger),
          ),
          onTap: () => ref.read(authControllerProvider.notifier).logout(),
        ),
      ],
    );
  }
}
