import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/push/push_notification_service.dart';
import 'core/router/app_router.dart';
import 'core/settings/app_settings.dart';
import 'core/widgets/chrome/connection_banner.dart';
import 'core/theme/app_theme.dart';
import 'features/notifications/data/notification_models.dart';
import 'features/notifications/state/notifications_providers.dart';
import 'features/notifications/presentation/notification_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();

  // Every face the app uses is bundled under assets/fonts/ and declared in
  // pubspec.yaml, so nothing is fetched at runtime. Left explicitly false so
  // a stray GoogleFonts call can never reintroduce a cold-start network hang.
  GoogleFonts.config.allowRuntimeFetching = false;

  // No Firebase project exists yet (see README "Phase 8 status") — this
  // is a no-op until one is wired up; never blocks app start. The tap
  // callback (BUILD_PLAN Phase 11 deep-linking) is wired here rather than
  // inside the feature-agnostic PushNotificationService itself.
  unawaited(
    PushNotificationService(
      onForegroundMessage: (title, body, data) {
        final context = rootNavigatorKey.currentContext;
        if (context == null || (title == null && body == null)) return;
        // Refresh the notifications list and the unread badge right away.
        ProviderScope.containerOf(context).invalidate(notificationsProvider);
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(
            content: Text([title, body].whereType<String>().join('\n')),
            duration: const Duration(seconds: 5),
          ),
        );
      },
      onNotificationTap: (data) {
        final type = data['type'] as String?;
        final context = rootNavigatorKey.currentContext;
        if (type == null || context == null) return;
        routeNotification(
          context,
          AppNotification(
            id: '',
            type: type,
            message: '',
            isRead: true,
            orderId: data['orderId'] as String?,
            disputeId: data['disputeId'] as String?,
            productId: data['productId'] as String?,
          ),
        );
      },
    ).initialize(),
  );

  // Painted in the saved theme from the first frame — no light flash.
  final savedTheme = await loadSavedThemeMode();

  // Seeded before the first frame so the very first tap already honours
  // the user's setting rather than buzzing at the default strength once.
  await loadSavedHapticSettings();

  runApp(
    ProviderScope(
      overrides: [
        themeModeProvider.overrideWith(
          (ref) => ThemeModeController(savedTheme),
        ),
      ],
      child: const BatamartApp(),
    ),
  );
}

class BatamartApp extends ConsumerWidget {
  const BatamartApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Batamart',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ref.watch(themeModeProvider),
      routerConfig: ref.watch(routerProvider),
      // Wrapped here rather than per screen so a dropped connection is visible
      // from anywhere in the app, including inside pushed routes and sheets.
      builder: (context, child) =>
          ConnectionBanner(child: child ?? const SizedBox.shrink()),
    );
  }
}
