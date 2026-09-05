import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_typography.dart';

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
      decoration: BoxDecoration(
        color: context.palette.card,
        border: Border(top: BorderSide(color: context.palette.hairline)),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              Expanded(child: _navItem(context, _items[0])),
              Expanded(child: _navItem(context, _items[1])),
              Expanded(
                child: _OnlineToggle(
                  isOnline: isOnline,
                  onChanged: onOnlineToggled,
                ),
              ),
              Expanded(child: _navItem(context, _items[2])),
              Expanded(child: _navItem(context, _items[3])),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(BuildContext context, ({RiderNavTab tab, String label, IconData icon}) item) {
    final p = context.palette;
    final isSelected = currentTab == item.tab;
    // Matches the buyer/seller shell exactly — same visual treatment, separate
    // component, because riders are walled off from those flows server-side.
    final color = isSelected ? p.ink : p.inkMuted;

    return InkWell(
      onTap: () => onTabSelected(item.tab),
      child: Stack(
        children: [
          if (isSelected)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Center(
                child: Container(width: 34, height: 2, color: p.ink),
              ),
            ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(item.icon, color: color, size: 21),
              const SizedBox(height: 5),
              Text(item.label.toUpperCase(),
                  style: AppTypography.label(size: 9, color: color)),
            ],
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
    final color = isOnline ? AppColors.success : context.palette.inkSecondary;

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
