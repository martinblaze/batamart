import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/settings/app_settings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chrome/app_bar.dart';

/// Dedicated Settings entry point (Profile tab previously had no such
/// screen — notifications/dark-mode toggles now live here instead of
/// nowhere). See `core/settings/app_settings.dart` for exactly what each
/// toggle does and does not control.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = ref.watch(themeModeProvider) == ThemeMode.dark;
    final notificationsEnabled = ref.watch(notificationsEnabledProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Settings', showBack: true),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          const _SectionLabel('Appearance'),
          _SettingsTile(
            icon: LucideIcons.moon,
            title: 'Dark Mode',
            subtitle: 'Use a dark color scheme across the app.',
            trailing: Switch(
              value: isDark,
              onChanged: (value) =>
                  ref.read(themeModeProvider.notifier).setDarkMode(value),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          const _SectionLabel('Notifications'),
          _SettingsTile(
            icon: LucideIcons.bell,
            title: 'Push Notifications',
            subtitle:
                'Get notified about orders, wallet activity, and messages.',
            trailing: Switch(
              value: notificationsEnabled,
              onChanged: (value) => ref
                  .read(notificationsEnabledProvider.notifier)
                  .setEnabled(value),
            ),
          ),
          if (notificationsEnabled) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Text(
                'In-app notifications always work (pull to refresh on the '
                'Notifications screen). Push alerts to your device require a '
                'small remaining backend setup on our end — you\'ll get them '
                'automatically once that\'s live.',
                style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(
        label,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 13,
          color: context.palette.inkSecondary,
        ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailing,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.palette.card,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: context.palette.hairline),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
            child: Icon(icon, size: 18, color: AppColors.primary),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: context.palette.inkSecondary,
                  ),
                ),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }
}
