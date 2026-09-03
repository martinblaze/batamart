import 'dart:async';

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

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await GoogleSignIn.instance.initialize(
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
