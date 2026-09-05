import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/nav/rider_nav_shell.dart';
import '../../auth/presentation/edit_profile_sheet.dart';
import '../../auth/state/auth_controller.dart';
import '../../rider/presentation/rider_dashboard_screen.dart';
import '../../rider/presentation/rider_deliveries_screen.dart';
import '../../rider/state/rider_providers.dart';
import '../../wallet/presentation/wallet_screen.dart';

/// Landing shell for RIDER after login. Dashboard/Deliveries/Earnings are
/// all real Phase 10 screens; the online/offline toggle here and the one
/// inline on the Dashboard screen both read/write the same
/// `user.isAvailable` via `POST /api/riders/toggle-availability`
/// (BACKEND_REFERENCE.md §3.12), so they always agree.
class RiderHomeShell extends ConsumerStatefulWidget {
  const RiderHomeShell({super.key});

  @override
  ConsumerState<RiderHomeShell> createState() => _RiderHomeShellState();
}

class _RiderHomeShellState extends ConsumerState<RiderHomeShell> {
  RiderNavTab _tab = RiderNavTab.dashboard;

  static const _titles = {
    RiderNavTab.dashboard: 'Dashboard',
    RiderNavTab.deliveries: 'Deliveries',
    RiderNavTab.earnings: 'Earnings',
    RiderNavTab.profile: 'Profile',
  };

  Future<void> _toggleOnline(bool _) async {
    await ref.read(riderRepositoryProvider).toggleAvailability();
    await ref.read(authControllerProvider.notifier).refreshUser();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_titles[_tab]!)),
      body: _buildBody(),
      // Auth-state watch lives in this Consumer (not this widget's own
      // build) so a `refreshUser()` call elsewhere only rebuilds the
      // online/offline toggle, not whichever full-screen tab body is
      // currently active.
      bottomNavigationBar: Consumer(
        builder: (context, ref, _) {
          final isOnline =
              ref.watch(authControllerProvider).user?.isAvailable ?? false;
          return RiderBottomNav(
            currentTab: _tab,
            isOnline: isOnline,
            onTabSelected: (tab) => setState(() => _tab = tab),
            onOnlineToggled: _toggleOnline,
          );
        },
      ),
    );
  }

  Widget _buildBody() {
    switch (_tab) {
      case RiderNavTab.dashboard:
        return const RiderDashboardScreen();
      case RiderNavTab.deliveries:
        return const RiderDeliveriesScreen();
      case RiderNavTab.earnings:
        return const WalletBody();
      case RiderNavTab.profile:
        return const _RiderProfilePlaceholder();
    }
  }
}

class _RiderProfilePlaceholder extends ConsumerWidget {
  const _RiderProfilePlaceholder();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.name ?? '',
                    style: AppTypography.display(size: 20, weight: FontWeight.w700),
                  ),
                  Text(
                    user?.email ?? '',
                    style: TextStyle(color: context.palette.inkSecondary),
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
