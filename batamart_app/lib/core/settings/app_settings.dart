import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

const _settingsBoxName = 'settings_box';
const _darkModeKey = 'dark_mode_enabled';
const _notificationsKey = 'notifications_enabled';

Future<Box> _openSettingsBox() => Hive.openBox(_settingsBoxName);

final themeModeProvider =
    StateNotifierProvider<ThemeModeController, ThemeMode>(
      (ref) => ThemeModeController(),
    );

/// Reads the persisted theme preference synchronously enough to seed the very
/// first frame. Call from `main()` before `runApp` and hand the result to a
/// `themeModeProvider` override — otherwise dark-mode users see a light flash
/// while the async load completes.
Future<ThemeMode> loadSavedThemeMode() async {
  try {
    final box = await _openSettingsBox();
    final enabled = box.get(_darkModeKey) as bool? ?? false;
    return enabled ? ThemeMode.dark : ThemeMode.light;
  } catch (_) {
    // A storage failure must never stop the app booting.
    return ThemeMode.light;
  }
}

/// Persists the dark-mode preference to Hive so it survives app restarts.
/// Applies to `MaterialApp.router`'s `themeMode` (see `main.dart`) — this
/// correctly darkens every Material-default surface (Scaffold background,
/// AppBar, inputs, buttons, bottom sheets, dialogs). Widgets that hardcode
/// an `AppColors.*` constant directly instead of reading from `Theme`
/// (several custom cards/badges across the app) won't repaint — a scoped,
/// known limitation given how much of the design system predates this
/// toggle, not an oversight.
class ThemeModeController extends StateNotifier<ThemeMode> {
  /// [initial] comes from [loadSavedThemeMode], read before `runApp` so the
  /// first frame is already painted in the right theme. The async [_load]
  /// stays as a fallback for the case where the box was not pre-opened.
  ThemeModeController([ThemeMode? initial])
      : super(initial ?? ThemeMode.light) {
    if (initial == null) _load();
  }

  Future<void> _load() async {
    final box = await _openSettingsBox();
    final enabled = box.get(_darkModeKey) as bool? ?? false;
    state = enabled ? ThemeMode.dark : ThemeMode.light;
  }

  bool get isDark => state == ThemeMode.dark;

  Future<void> setDarkMode(bool enabled) async {
    state = enabled ? ThemeMode.dark : ThemeMode.light;
    final box = await _openSettingsBox();
    await box.put(_darkModeKey, enabled);
  }
}

final notificationsEnabledProvider =
    StateNotifierProvider<NotificationsPrefController, bool>(
      (ref) => NotificationsPrefController(),
    );

/// Local "I want notifications" preference, persisted to Hive. This is a UI
/// preference plus a best-effort OS permission request — it does NOT mean
/// push notifications actually work end to end: `core/push/
/// push_notification_service.dart` documents that FCM is wired client-side
/// but inert until a Firebase project + a new backend token-storage
/// endpoint exist (the backend only accepts Web Push VAPID tokens today).
/// Toggling this on requests the OS permission and lets the in-app
/// notification badge/polling behave as "enabled"; it can't make push
/// itself work before those two backend-side gaps close.
class NotificationsPrefController extends StateNotifier<bool> {
  NotificationsPrefController() : super(true) {
    _load();
  }

  Future<void> _load() async {
    final box = await _openSettingsBox();
    state = box.get(_notificationsKey) as bool? ?? true;
  }

  Future<void> setEnabled(bool enabled) async {
    state = enabled;
    final box = await _openSettingsBox();
    await box.put(_notificationsKey, enabled);
  }
}
