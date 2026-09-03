import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';

/// The rider-only bottom nav — structurally separate from
/// [BuyerSellerBottomNav] per `docs/mockups/README.md`'s "Resolved: rider
/// bottom nav" note: Dashboard / Deliveries / online-offline toggle /
/// Earnings / Profile, no Home/Deals/Cart tabs. The center slot is a
/// toggle switch, not a navigable tab.
enum RiderNavTab { dashboard, deliveries, earnings, profile }

class RiderBottomNav extends StatelessWidget {
  const RiderBottomNav({
    super.key,
    required this.currentTab,
    required this.onTabSelected,
    required this.isOnline,
    required this.onOnlineToggled,
  });

  final RiderNavTab currentTab;
  final ValueChanged<RiderNavTab> onTabSelected;
  final bool isOnline;
  final ValueChanged<bool> onOnlineToggled;

  static const _items = [
    (
      tab: RiderNavTab.dashboard,
      label: 'Dashboard',
      icon: LucideIcons.layoutDashboard,
    ),
    (tab: RiderNavTab.deliveries, label: 'Deliveries', icon: LucideIcons.truck),
    (tab: RiderNavTab.earnings, label: 'Earnings', icon: LucideIcons.wallet),
    (tab: RiderNavTab.profile, label: 'Profile', icon: LucideIcons.user),
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
          height: 64,
          child: Row(
            children: [
              Expanded(child: _navItem(_items[0])),
              Expanded(child: _navItem(_items[1])),
              Expanded(
                child: _OnlineToggle(
                  isOnline: isOnline,
                  onChanged: onOnlineToggled,
                ),
              ),
              Expanded(child: _navItem(_items[2])),
              Expanded(child: _navItem(_items[3])),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(({RiderNavTab tab, String label, IconData icon}) item) {
    final isSelected = currentTab == item.tab;
    final color = isSelected ? AppColors.primary : AppColors.textSecondary;

    return InkWell(
      onTap: () => onTabSelected(item.tab),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(item.icon, color: color, size: 22),
          const SizedBox(height: 2),
          Text(
            item.label,
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

class _OnlineToggle extends StatelessWidget {
  const _OnlineToggle({required this.isOnline, required this.onChanged});

  final bool isOnline;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final color = isOnline ? AppColors.success : AppColors.textSecondary;

    return InkWell(
      onTap: () => onChanged(!isOnline),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(LucideIcons.power, color: color, size: 20),
          ),
          const SizedBox(height: 2),
          Text(
            isOnline ? 'Online' : 'Offline',
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
