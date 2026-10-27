import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';

/// What the user has chosen to hear about, stored on the server so it applies
/// to push, email and every device. Order, payment and security messages are
/// always sent; these switches only gate the rest.
class NotificationPrefs {
  const NotificationPrefs({
    this.pushEnabled = true,
    this.emailEnabled = true,
    this.reminders = true,
    this.deals = true,
    this.marketing = true,
  });

  final bool pushEnabled;
  final bool emailEnabled;
  final bool reminders;
  final bool deals;
  final bool marketing;

  factory NotificationPrefs.fromJson(Map<String, dynamic> json) =>
      NotificationPrefs(
        pushEnabled: json['pushEnabled'] as bool? ?? true,
        emailEnabled: json['emailEnabled'] as bool? ?? true,
        reminders: json['reminders'] as bool? ?? true,
        deals: json['deals'] as bool? ?? true,
        marketing: json['marketing'] as bool? ?? true,
      );

  NotificationPrefs copyWith({
    bool? pushEnabled,
    bool? emailEnabled,
    bool? reminders,
    bool? deals,
    bool? marketing,
  }) => NotificationPrefs(
    pushEnabled: pushEnabled ?? this.pushEnabled,
    emailEnabled: emailEnabled ?? this.emailEnabled,
    reminders: reminders ?? this.reminders,
    deals: deals ?? this.deals,
    marketing: marketing ?? this.marketing,
  );
}

final notificationPrefsProvider =
    FutureProvider.autoDispose<NotificationPrefs>((ref) async {
      final response = await ApiClient.instance.get(
        '/api/notifications/preferences',
      );
      return NotificationPrefs.fromJson(
        (response['preferences'] as Map).cast<String, dynamic>(),
      );
    });

class NotificationPreferencesSection extends ConsumerStatefulWidget {
  const NotificationPreferencesSection({super.key});

  @override
  ConsumerState<NotificationPreferencesSection> createState() =>
      _NotificationPreferencesSectionState();
}

class _NotificationPreferencesSectionState
    extends ConsumerState<NotificationPreferencesSection> {
  NotificationPrefs? _local;
  String? _error;

  Future<void> _set(String key, bool value, NotificationPrefs current) async {
    Haptics.tap();
    setState(() {
      _error = null;
      _local = switch (key) {
        'pushEnabled' => current.copyWith(pushEnabled: value),
        'emailEnabled' => current.copyWith(emailEnabled: value),
        'reminders' => current.copyWith(reminders: value),
        'deals' => current.copyWith(deals: value),
        _ => current.copyWith(marketing: value),
      };
    });
    try {
      await ApiClient.instance.put(
        '/api/notifications/preferences',
        data: {key: value},
      );
    } catch (_) {
      if (mounted) {
        setState(() {
          _local = current;
          _error = 'Could not save that change. Try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(notificationPrefsProvider);
    final prefs = _local ?? async.asData?.value;

    if (prefs == null) {
      return async.hasError
          ? Text(
              'Could not load your notification choices.',
              style: TextStyle(color: context.palette.inkSecondary, fontSize: 12),
            )
          : const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: Center(child: CircularProgressIndicator()),
            );
    }

    Widget row(String key, String title, String hint, bool value) => SwitchListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(
        hint,
        style: TextStyle(color: context.palette.inkSecondary, fontSize: 12),
      ),
      value: value,
      onChanged: (v) => _set(key, v, prefs),
    );

    return Column(
      children: [
        row('pushEnabled', 'Push notifications', 'Alerts on your phone.', prefs.pushEnabled),
        row('emailEnabled', 'Emails', 'Receipts, summaries and updates.', prefs.emailEnabled),
        row('reminders', 'Reminders', 'Delivery day, handover and review reminders.', prefs.reminders),
        row('deals', 'Flash and hot deals', 'New deals and trending items on campus.', prefs.deals),
        row('marketing', 'Tips and offers', 'Weekly digest and referral nudges.', prefs.marketing),
        Padding(
          padding: const EdgeInsets.only(top: AppSpacing.xs),
          child: Text(
            'Order, payment and security messages always reach you.',
            style: TextStyle(color: context.palette.inkMuted, fontSize: 11),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
          ),
      ],
    );
  }
}
