import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/config/env.dart';

/// Thin wrapper around google_sign_in v7's init-once-then-authenticate API.
/// Returns the ID token `POST /api/auth/google` verifies server-side
/// (BACKEND_REFERENCE.md §3.1) — the audience on that token must match the
/// backend's configured `GOOGLE_CLIENT_ID`, which is why initialization
/// uses [Env.googleServerClientId] (a Web-type OAuth client) rather than
/// the Android-type client that authorizes this app package/SHA-1 with
/// Google (that one never appears in code — Google Play Services looks it
/// up by package name + signing certificate automatically).
class GoogleAuthService {
  GoogleAuthService._();
  static final instance = GoogleAuthService._();

  bool _initialized = false;

  /// Apple platforms need an explicit iOS-type client ID; Android resolves
  /// its own client from package name + SHA-1 via Credential Manager and must
  /// NOT be given one. `kIsWeb` is checked first because
  /// `defaultTargetPlatform` reports iOS for Safari on an iPhone.
  static bool get _needsExplicitClientId =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.macOS);

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    if (_needsExplicitClientId && Env.googleIosClientId.isEmpty) {
      throw StateError(
        'GOOGLE_IOS_CLIENT_ID is not set. Google sign-in cannot work on '
        'iOS without an iOS-type OAuth client ID from Google Cloud project '
        '451382163885 (see Env.googleIosClientId).',
      );
    }
    await GoogleSignIn.instance.initialize(
      clientId: _needsExplicitClientId ? Env.googleIosClientId : null,
      serverClientId: Env.googleServerClientId,
    );
    _initialized = true;
  }

  /// Throws [GoogleSignInException] (`.canceled` when the user backs out
  /// of the picker), [StateError] if Google didn't hand back an ID token,
  /// or [TimeoutException] if `authenticate()` never resolves at all.
  ///
  /// The timeout exists because Credential Manager's account picker is
  /// known to hang indefinitely — with no exception and no return — when
  /// the device/emulator lacks Google Play Services, or when the signing
  /// certificate's SHA-1 isn't registered against the Android OAuth client
  /// in Google Cloud Console (mismatched debug vs. release keystore is the
  /// usual cause). Without this, `_isGoogleLoading` in the UI would spin
  /// forever with no feedback for either case.
  Future<String> signIn() async {
    await _ensureInitialized();
    final account = await GoogleSignIn.instance.authenticate().timeout(
      const Duration(seconds: 45),
      onTimeout: () => throw TimeoutException(
        'Google sign-in did not respond. This usually means Google Play '
        'Services is unavailable on this device/emulator, or the app\'s '
        'signing certificate (SHA-1) isn\'t registered for this OAuth '
        'client in Google Cloud Console.',
      ),
    );
    final idToken = account.authentication.idToken;
    if (idToken == null) {
      throw StateError('Google sign-in did not return an ID token.');
    }
    return idToken;
  }
}
