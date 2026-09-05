import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';
import '../../motion/motion.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_typography.dart';

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
      decoration: BoxDecoration(
        color: context.palette.card,
        border: Border(top: BorderSide(color: context.palette.hairline)),
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
    final p = context.palette;
    // Selected reads as ink, not accent: the accent is spent once per screen
    // on the primary action, and a permanently-blue tab would outshout it.
    final color = isSelected ? p.ink : p.inkMuted;

    return Pressable(
      onTap: onTap,
      scale: 0.9,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // The rule sits in the same column as the icon rather than floating
          // over the cell, so it cannot drift out of alignment — which it did
          // on Cart, where the unread badge pulls the icon's mass right.
          AnimatedContainer(
            duration: Motion.base,
            curve: Motion.ease,
            width: isSelected ? 34 : 0,
            height: 2,
            color: p.ink,
          ),
          const SizedBox(height: 9),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  AnimatedScale(
                    scale: isSelected ? 1.06 : 1,
                    duration: Motion.base,
                    curve: Motion.ease,
                    child: Icon(icon, color: color, size: 21),
                  ),
                  if (badgeCount > 0)
                    Positioned(
                      right: -7,
                      top: -5,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 1,
                        ),
                        decoration: const BoxDecoration(
                          color: AppColors.danger,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 15),
                        child: Text(
                          badgeCount > 9 ? '9+' : '$badgeCount',
                          textAlign: TextAlign.center,
                          style: AppTypography.label(
                            size: 8,
                            color: Colors.white,
                            weight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 5),
              AnimatedDefaultTextStyle(
                duration: Motion.base,
                curve: Motion.ease,
                style: AppTypography.label(size: 9, color: color),
                child: Text(label.toUpperCase()),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
