import 'package:flutter/material.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
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
import '../../notifications/state/notifications_providers.dart';
import '../../../core/motion/motion.dart';

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
      appBar: AppBar(
        title: Text(_titles[_tab]!),
        actions: const [_SearchAction(), _NotificationBell(), SizedBox(width: 6)],
      ),
      body: _buildBody(),
      floatingActionButton: _tab == BuyerSellerNavTab.home
          ? Consumer(
              builder: (context, ref, _) {
                final user = ref.watch(authControllerProvider).user;
                return FloatingActionButton(
                  tooltip: 'Sell a product',
                  onPressed: () {
                    Haptics.tap();
                    context.push(
                      (user?.isSeller ?? false)
                          ? AppRoutes.sellProduct
                          : AppRoutes.becomeSeller,
                    );
                  },
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
            onTabSelected: (tab) {
              // Only on an actual change: re-tapping the current tab is a
              // no-op, and buzzing for it would feel like a misfire.
              if (tab != _tab) Haptics.tap();
              setState(() => _tab = tab);
            },
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
            onSeeAllDeals: () => setState(() => _tab = BuyerSellerNavTab.deals),
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

/// The Profile tab.
///
/// Was one undifferentiated run of fourteen ListTiles — everything from
/// "Wallet" to "Logout" at the same visual weight, so finding anything meant
/// reading the whole list. Now grouped under mono headings, with the account
/// identity as a plain block rather than a large avatar: there is no
/// profile-photo upload in this app, so a 64px circle showing one letter was
/// spending the most prominent spot on the screen to say nothing.
class _ProfilePlaceholder extends ConsumerWidget {
  const _ProfilePlaceholder();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final palette = context.palette;
    final isSeller = user?.isSeller ?? false;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // ── Identity ─────────────────────────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: palette.card,
            border: Border(bottom: BorderSide(color: palette.hairline)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Welcome, ${user?.name ?? 'there'}',
                      style: AppTypography.display(size: 20, weight: FontWeight.w700),
                    ),
                  ),
                  if (user != null) TrustBadge(level: user.trustLevel),
                  Pressable(
                    onTap: () => showEditProfileSheet(context, ref),
                    child: Padding(
                      padding: const EdgeInsets.only(left: AppSpacing.sm),
                      child: Icon(LucideIcons.pencil, size: 16, color: palette.inkMuted),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                user?.email ?? user?.phone ?? '',
                style: TextStyle(color: AppColors.primary, fontSize: 13),
              ),
              if ((user?.hostelName ?? '').isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Icon(LucideIcons.mapPin, size: 13, color: palette.inkMuted),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        [user?.hostelName, user?.roomNumber, user?.landmark]
                            .where((e) => (e ?? '').isNotEmpty)
                            .join(', '),
                        style: TextStyle(fontSize: 12, color: palette.inkSecondary),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),

        // ── Seller mode ──────────────────────────────────────────────────
        if (isSeller)
          Container(
            color: palette.card,
            child: SwitchListTile(
              secondary: const Icon(LucideIcons.repeat, size: 19),
              title: Text('Seller mode', style: AppTypography.display(size: 14, weight: FontWeight.w600)),
              subtitle: Text(
                user!.isSellerMode ? 'Selling' : 'Buying',
                style: const TextStyle(fontSize: 12),
              ),
              value: user.isSellerMode,
              onChanged: (v) => ref
                  .read(authControllerProvider.notifier)
                  .toggleSellerMode(isSellerMode: v),
            ),
          ),

        const _ProfileGroup(
          heading: 'My account',
          rows: [
            _Row(LucideIcons.wallet, 'Wallet', AppRoutes.wallet),
            _Row(LucideIcons.bell, 'Notifications', AppRoutes.notifications),
            _Row(LucideIcons.gift, 'Referrals', AppRoutes.referrals),
            _Row(LucideIcons.scale, 'Disputes', AppRoutes.disputes),
          ],
        ),

        if (isSeller)
          const _ProfileGroup(
            heading: 'Selling',
            rows: [
              _Row(LucideIcons.store, 'My shop', AppRoutes.myShop),
              _Row(LucideIcons.clipboardList, 'Sales', AppRoutes.sales),
              _Row(LucideIcons.plus, 'List a product', AppRoutes.sellProduct),
            ],
          ),

        const _ProfileGroup(
          heading: 'Discover',
          rows: [
            _Row(LucideIcons.trendingUp, 'Most bought', AppRoutes.mostBought),
            _Row(LucideIcons.users, 'Sellers', AppRoutes.sellerDirectory),
          ],
        ),

        _ProfileGroup(
          heading: 'Settings',
          rows: [
            const _Row(LucideIcons.settings, 'App settings', AppRoutes.settings),
            _Row(
              LucideIcons.mapPin,
              'Delivery address',
              AppRoutes.profileSetup,
              onTap: () => showAddressSheet(context, ref),
            ),
            if (user?.isBuyer ?? false)
              const _Row(LucideIcons.store, 'Become a seller', AppRoutes.becomeSeller),
          ],
        ),

        const SizedBox(height: AppSpacing.lg),
        Pressable(
          onTap: () => ref.read(authControllerProvider.notifier).logout(),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
            decoration: BoxDecoration(
              color: palette.card,
              border: Border(
                top: BorderSide(color: palette.hairline),
                bottom: BorderSide(color: palette.hairline),
              ),
            ),
            child: Center(
              child: Text(
                'LOG OUT',
                style: AppTypography.label(size: 11, color: AppColors.danger),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}

/// One row in a profile group: icon, label, destination.
class _Row {
  const _Row(this.icon, this.label, this.route, {this.onTap});
  final IconData icon;
  final String label;
  final String route;

  /// When set, the row runs this instead of navigating — used by rows that
  /// open a sheet rather than a page.
  final VoidCallback? onTap;
}

/// A titled group of navigation rows, hairline-separated.
class _ProfileGroup extends StatelessWidget {
  const _ProfileGroup({required this.heading, required this.rows});

  final String heading;
  final List<_Row> rows;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xl,
            AppSpacing.lg,
            AppSpacing.sm,
          ),
          child: Text(
            heading.toUpperCase(),
            style: AppTypography.label(size: 10, color: palette.inkSecondary),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: palette.card,
            border: Border(
              top: BorderSide(color: palette.hairline),
              bottom: BorderSide(color: palette.hairline),
            ),
          ),
          child: Column(
            children: [
              for (final (i, row) in rows.indexed)
                Pressable(
                  onTap: row.onTap ?? () => context.push(row.route),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                      vertical: AppSpacing.md + 2,
                    ),
                    decoration: BoxDecoration(
                      border: Border(
                        top: BorderSide(
                          color: i == 0 ? Colors.transparent : palette.hairline,
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(row.icon, size: 18, color: palette.ink),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Text(row.label, style: const TextStyle(fontSize: 14)),
                        ),
                        Icon(LucideIcons.chevronRight, size: 16, color: palette.inkMuted),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}


/// Search, reachable from every tab. Previously search was only findable by
/// scrolling to the bar inside the Home feed.
class _SearchAction extends StatelessWidget {
  const _SearchAction();

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Search',
      icon: const Icon(LucideIcons.search, size: 20),
      onPressed: () {
        Haptics.screen();
        context.push(AppRoutes.search);
      },
    );
  }
}

/// Notification bell with an unread count.
///
/// Notifications used to be reachable only as a list row buried in the
/// Profile tab, so there was no way to tell you had any without going looking.
/// The badge is the whole point: it is what makes the feature discoverable.
class _NotificationBell extends ConsumerWidget {
  const _NotificationBell();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Failure here must stay invisible — a notifications outage should cost
    // the badge, not the app bar.
    final unread = ref.watch(notificationsProvider).asData?.value.unreadCount ?? 0;

    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        IconButton(
          tooltip: unread > 0 ? '$unread unread notifications' : 'Notifications',
          icon: const Icon(LucideIcons.bell, size: 20),
          onPressed: () => context.push(AppRoutes.notifications),
        ),
        if (unread > 0)
          Positioned(
            right: 6,
            top: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              constraints: const BoxConstraints(minWidth: 15),
              decoration: const BoxDecoration(
                color: AppColors.danger,
                shape: BoxShape.circle,
              ),
              child: Text(
                unread > 9 ? '9+' : '$unread',
                textAlign: TextAlign.center,
                style: AppTypography.label(size: 8, color: Colors.white),
              ),
            ).pop(),
          ),
      ],
    );
  }
}
