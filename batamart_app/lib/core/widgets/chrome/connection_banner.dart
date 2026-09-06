import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../api/api_client.dart';
import '../../haptics/haptics.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';

/// A bar that drops in whenever the app cannot reach the server.
///
/// Wrapped around the whole router in `main.dart` rather than added per
/// screen, so losing signal is visible wherever the user happens to be —
/// previously an offline device just showed whichever screen's error state was
/// unlucky enough to load, with no indication the problem was the network.
///
/// It listens to [ApiClient.isOnline], which is driven by real request
/// outcomes and a background probe while offline, so the bar raises and clears
/// itself without the user doing anything.
class ConnectionBanner extends StatefulWidget {
  const ConnectionBanner({required this.child, super.key});

  final Widget child;

  @override
  State<ConnectionBanner> createState() => _ConnectionBannerState();
}

class _ConnectionBannerState extends State<ConnectionBanner> {
  @override
  void initState() {
    super.initState();
    ApiClient.isOnline.addListener(_onConnectionChanged);
  }

  @override
  void dispose() {
    ApiClient.isOnline.removeListener(_onConnectionChanged);
    super.dispose();
  }

  /// One buzz on the transition into offline, so a user looking away still
  /// notices. Driven by the listener rather than the bar's own `initState`:
  /// the bar stays mounted so it can animate out, which would otherwise fire
  /// this once at app launch while perfectly online.
  void _onConnectionChanged() {
    if (!ApiClient.isOnline.value) Haptics.error();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          child: ValueListenableBuilder<bool>(
            valueListenable: ApiClient.isOnline,
            builder: (context, online, child) {
              return AnimatedSlide(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOut,
                offset: online ? const Offset(0, -1) : Offset.zero,
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 220),
                  opacity: online ? 0 : 1,
                  // Ignored while hidden so the invisible bar cannot swallow
                  // taps meant for the app bar underneath it.
                  child: IgnorePointer(ignoring: online, child: child),
                ),
              );
            },
            child: const _OfflineBar(),
          ),
        ),
      ],
    );
  }
}

class _OfflineBar extends StatelessWidget {
  const _OfflineBar();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.danger,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.wifiOff, size: 14, color: Colors.white),
              const SizedBox(width: AppSpacing.sm),
              const Flexible(
                child: Text(
                  'No internet connection',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              // Honest: ApiClient really is probing the server every few
              // seconds while this is showing.
              SizedBox(
                height: 11,
                width: 11,
                child: CircularProgressIndicator(
                  strokeWidth: 1.6,
                  valueColor: AlwaysStoppedAnimation(
                    Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
