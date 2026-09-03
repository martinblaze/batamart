import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';

/// The buyer/seller shared bottom nav — Home / Deals / Cart / Orders /
/// Profile, per `docs/mockups/README.md` and `WEB_PAGES_REFERENCE.md`'s
/// "mobile buyer/seller bottom tab bar" (there Market/Orders/Sell(+)/
/// Wallet/Profile — the mockups instead show Home/Deals/Cart/Orders/
/// Profile consistently across every buyer+seller frame, which is what
/// this implements). Seller-mode nav-item swaps (if any) are a Phase 7
/// concern, not this shell's.
enum BuyerSellerNavTab { home, deals, cart, orders, profile }

class BuyerSellerBottomNav extends StatelessWidget {
  const BuyerSellerBottomNav({
    super.key,
    required this.currentTab,
    required this.onTabSelected,
    this.cartItemCount = 0,
  });

  final BuyerSellerNavTab currentTab;
  final ValueChanged<BuyerSellerNavTab> onTabSelected;
  final int cartItemCount;

  static const _items = [
    (tab: BuyerSellerNavTab.home, label: 'Home', icon: LucideIcons.home),
    (tab: BuyerSellerNavTab.deals, label: 'Deals', icon: LucideIcons.tag),
    (
      tab: BuyerSellerNavTab.cart,
      label: 'Cart',
      icon: LucideIcons.shoppingCart,
    ),
    (tab: BuyerSellerNavTab.orders, label: 'Orders', icon: LucideIcons.package),
    (tab: BuyerSellerNavTab.profile, label: 'Profile', icon: LucideIcons.user),
  ];

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              for (final item in _items)
                Expanded(
                  child: _NavItem(
                    label: item.label,
                    icon: item.icon,
                    isSelected: currentTab == item.tab,
                    badgeCount: item.tab == BuyerSellerNavTab.cart
                        ? cartItemCount
                        : 0,
                    onTap: () => onTabSelected(item.tab),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
    this.badgeCount = 0,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final color = isSelected ? AppColors.primary : AppColors.textSecondary;

    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(icon, color: color, size: 22),
              if (badgeCount > 0)
                Positioned(
                  right: -6,
                  top: -4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 1,
                    ),
                    decoration: const BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 14),
                    child: Text(
                      '$badgeCount',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
