import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../state/auth_controller.dart';

/// Shown when a *stored, still-valid* token belongs to a now-suspended
/// account (BACKEND_REFERENCE.md §3.1 — `GET /api/auth/me` 403s with
/// `{ suspended: true, reason, until }` instead of the normal 200 in this
/// case). BUILD_PLAN Phase 11 — surfaces the actual reason/until instead
/// of silently bouncing to login with no explanation.
class SuspendedScreen extends ConsumerStatefulWidget {
  const SuspendedScreen({super.key});

  @override
  ConsumerState<SuspendedScreen> createState() => _SuspendedScreenState();
}

class _SuspendedScreenState extends ConsumerState<SuspendedScreen> {
  bool _isRetrying = false;

  Future<void> _retry() async {
    setState(() => _isRetrying = true);
    await ref.read(authControllerProvider.notifier).retryAfterSuspension();
    if (mounted) setState(() => _isRetrying = false);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                LucideIcons.shieldAlert,
                size: 56,
                color: AppColors.danger,
              ),
              const SizedBox(height: AppSpacing.lg),
              const Text(
                'Account Suspended',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                state.suspensionReason ??
                    'Your account has been suspended by an administrator.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              if (state.suspensionUntil != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Suspended until ${state.suspensionUntil}',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              _isRetrying
                  ? const CircularProgressIndicator()
                  : SecondaryButton(
                      label: 'Refresh',
                      onPressed: _retry,
                      expand: false,
                    ),
              const SizedBox(height: AppSpacing.sm),
              TextButton(
                onPressed: () =>
                    ref.read(authControllerProvider.notifier).logout(),
                child: const Text('Logout'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
