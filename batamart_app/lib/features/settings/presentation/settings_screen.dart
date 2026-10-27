import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/settings/app_settings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/config/env.dart';
import 'notification_preferences_section.dart';
import '../../auth/presentation/username_sheet.dart';
import '../../auth/state/auth_controller.dart';

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
    final hapticsEnabled = ref.watch(hapticsEnabledProvider);
    final hapticStrength = ref.watch(hapticStrengthProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Settings', showBack: true),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          const _SectionLabel('Account'),
          Builder(
            builder: (context) {
              final username = ref.watch(authControllerProvider).user?.username;
              final hasUsername = (username ?? '').isNotEmpty;
              return _SettingsTile(
                icon: LucideIcons.atSign,
                title: hasUsername ? '@$username' : 'Set a username',
                subtitle: hasUsername
                    ? 'Sellers write this on your parcel. Tap to change it.'
                    : 'Required to place an order. Sellers write it on your parcel.',
                trailing: Icon(LucideIcons.chevronRight, size: 18, color: context.palette.inkMuted),
                onTap: () async {
                  final saved = await showUsernameSheet(context, current: hasUsername ? username : null);
                  if (saved && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Username saved.')));
                  }
                },
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          const _SectionLabel('Appearance'),
          _SettingsTile(
            icon: LucideIcons.moon,
            title: 'Dark Mode',
            subtitle: 'Use a dark color scheme across the app.',
            trailing: Switch(
              value: isDark,
              onChanged: (value) {
                Haptics.tap();
                ref.read(themeModeProvider.notifier).setDarkMode(value);
              },
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
              onChanged: (value) {
                Haptics.tap();
                ref
                    .read(notificationsEnabledProvider.notifier)
                    .setEnabled(value);
              },
            ),
          ),
          if (notificationsEnabled) ...[
            const SizedBox(height: AppSpacing.sm),
            const NotificationPreferencesSection(),
          ],
          const SizedBox(height: AppSpacing.lg),
          const _SectionLabel('Help and legal'),
          _LinkTile(icon: LucideIcons.lifeBuoy, title: 'Contact support', path: '/contact'),
          _LinkTile(icon: LucideIcons.info, title: 'About BataMart', path: '/about'),
          _LinkTile(icon: LucideIcons.fileText, title: 'Terms of service', path: '/terms'),
          _LinkTile(icon: LucideIcons.shield, title: 'Privacy policy', path: '/privacy'),
          const SizedBox(height: AppSpacing.lg),
          const _SectionLabel('Feedback'),
          _SettingsTile(
            icon: LucideIcons.vibrate,
            title: 'Haptic Feedback',
            subtitle:
                'Feel a short vibration when you tap, add to cart, or pay.',
            trailing: Switch(
              value: hapticsEnabled,
              onChanged: (value) {
                // Fire before persisting when switching ON, so the very tap
                // that enables it is the first thing the user feels.
                if (value) Haptics.configure(enabled: true, strength: hapticStrength);
                Haptics.tap();
                ref.read(hapticsEnabledProvider.notifier).setEnabled(value);
              },
            ),
          ),
          if (hapticsEnabled) ...[
            const SizedBox(height: AppSpacing.sm),
            _HapticStrengthCard(
              strength: hapticStrength,
              onChanged: (value) {
                // Preview at the newly picked strength as the slider moves, so
                // the difference between steps is felt rather than guessed.
                ref.read(hapticStrengthProvider.notifier).setStrength(value);
                Haptics.change();
              },
            ),
          ],
        ],
      ),
    );
  }
}

/// The 5/25/50/75/100 strength picker. The steps are not evenly spaced as
/// numbers, so the slider runs over their *indices* and maps back — otherwise
/// dragging would linger between stops on a scale the user never chose.
class _HapticStrengthCard extends StatelessWidget {
  const _HapticStrengthCard({required this.strength, required this.onChanged});

  final int strength;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final steps = Haptics.strengthSteps;
    final index = steps.indexOf(strength).clamp(0, steps.length - 1);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.palette.card,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: context.palette.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Strength',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                '$strength%',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          Slider(
            value: index.toDouble(),
            min: 0,
            max: (steps.length - 1).toDouble(),
            divisions: steps.length - 1,
            label: '${steps[index]}%',
            onChanged: (value) {
              final next = steps[value.round()];
              if (next != strength) onChanged(next);
            },
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (final step in steps)
                Text(
                  '$step',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight:
                        step == strength ? FontWeight.w700 : FontWeight.w400,
                    color: step == strength
                        ? AppColors.primary
                        : context.palette.inkMuted,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Phones expose a fixed set of vibration patterns rather than a '
            'dial, so each step picks a firmer pattern instead of turning one '
            'up. Move the slider to feel the difference.',
            style: TextStyle(fontSize: 11, color: context.palette.inkSecondary),
          ),
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
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
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
    return onTap == null ? card : InkWell(onTap: onTap, child: card);
  }
}


/// A row that opens one of the website's pages (support, legal) in the browser.
class _LinkTile extends StatelessWidget {
  const _LinkTile({required this.icon, required this.title, required this.path});

  final IconData icon;
  final String title;
  final String path;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, size: 20, color: context.palette.inkSecondary),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing: Icon(LucideIcons.externalLink, size: 16, color: context.palette.inkMuted),
      onTap: () => launchUrl(
        Uri.parse('${Env.apiBaseUrl.replaceAll(RegExp(r'/$'), '')}$path'),
        mode: LaunchMode.externalApplication,
      ),
    );
  }
}
