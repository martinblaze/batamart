import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/push/push_notification_service.dart';
import 'core/router/app_router.dart';
import 'core/settings/app_settings.dart';
import 'core/theme/app_theme.dart';
import 'features/notifications/data/notification_models.dart';
import 'features/notifications/presentation/notification_router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();

  // Poppins isn't bundled as a local asset yet (see README "Phase 2 status"),
  // so leaving runtime fetching on means a cold start with no network hangs
  // waiting on fonts.gstatic.com instead of just falling back. Disable it
  // until real Poppins .ttf files are bundled under assets/fonts/.
  GoogleFonts.config.allowRuntimeFetching = false;

  // No Firebase project exists yet (see README "Phase 8 status") — this
  // is a no-op until one is wired up; never blocks app start. The tap
  // callback (BUILD_PLAN Phase 11 deep-linking) is wired here rather than
  // inside the feature-agnostic PushNotificationService itself.
  unawaited(
    PushNotificationService(
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

  runApp(const ProviderScope(child: BatamartApp()));
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
    );
  }
}
