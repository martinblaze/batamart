import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Client-side half of native push (BUILD_PLAN Phase 8 — "build FCM now,
/// flag the backend gap"). BACKEND_REFERENCE.md §3.10 only documents Web
/// Push (VAPID `{endpoint, keys}`), which an FCM token doesn't fit — see
/// README "Phase 8 status" for the exact new backend endpoint this needs.
///
/// Every call here is defensive: there is no `google-services.json` in
/// this repo yet (no Firebase project has been created), so
/// `Firebase.initializeApp()` throws at *runtime* — caught below so the
/// rest of the app keeps working with in-app/pull-based notifications
/// only until a real Firebase project is wired up. See README for the
/// exact 2 files that need adding once you have one.
///
/// Deliberately feature-agnostic (this lives in `core/`, so it must not
/// import a specific feature's models): [onNotificationTap] hands the raw
/// `data` payload to whoever constructs this service, which is where the
/// actual deep-link routing lives (see `main.dart`). Tap plumbing
/// (`onMessageOpenedApp` + `getInitialMessage` for a cold start) is wired
/// up per BUILD_PLAN Phase 11, but unverified until push itself works —
/// it assumes the eventual FCM payload's `data` map mirrors the in-app
/// `Notification` row's fields (`type`, `orderId`, `disputeId`,
/// `productId`); confirm that shape with the backend team when the new
/// FCM endpoint is built.
class PushNotificationService {
  PushNotificationService({this.onNotificationTap});

  /// Called with a tapped notification's raw `data` map — from a
  /// foreground tap, a backgrounded-app tap, or a cold start.
  final void Function(Map<String, dynamic> data)? onNotificationTap;

  bool _initialized = false;
  String? _fcmToken;

  String? get fcmToken => _fcmToken;
  bool get isAvailable => _initialized;

  Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint(
        'PushNotificationService: Firebase not configured yet ($e). Push disabled.',
      );
      return;
    }

    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      _fcmToken = await messaging.getToken();
      FirebaseMessaging.onBackgroundMessage(_backgroundMessageHandler);
      FirebaseMessaging.onMessage.listen(_onForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => onNotificationTap?.call(message.data),
      );

      // App was cold-started by tapping a notification.
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) onNotificationTap?.call(initialMessage.data);

      _initialized = true;
    } catch (e) {
      debugPrint('PushNotificationService: setup failed ($e). Push disabled.');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    // No local-notification package wired up yet — foreground messages
    // are logged only. In-app Notifications screen (polling
    // GET /api/notifications) is the reliable path until a backend
    // endpoint exists to actually register this token server-side.
    debugPrint(
      'PushNotificationService: foreground message ${message.messageId}',
    );
  }
}

@pragma('vm:entry-point')
Future<void> _backgroundMessageHandler(RemoteMessage message) async {
  // Must stay a top-level/static function per firebase_messaging's
  // isolate contract. Intentionally minimal until a backend endpoint
  // exists to do anything useful with the token.
}
