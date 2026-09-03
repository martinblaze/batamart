/// Build-time environment config. Defaults point at the real deployed
/// backend (`https://www.batamart.com`) since that's what the app is
/// actually tested against. Note the `www` — `https://batamart.com` (bare)
/// 308-redirects there, which would silently break POST bodies and send
/// the wrong `Origin` header on the CSRF-workaround calls below if used
/// instead; confirmed live against `GET /api/universities`, which already
/// returns the real UNIZIK data. Override for local development against a
/// `next dev`
/// server on the same machine with:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000 --dart-define=APP_ORIGIN=http://localhost:3000
/// (`10.0.2.2` is the Android emulator's alias for the host machine's
/// loopback address; use your machine's LAN IP instead for a physical
/// device.)
class Env {
  Env._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://www.batamart.com',
  );

  /// Value sent as the `Origin` header on the 5 auth routes the backend's
  /// `enforceSameOrigin` CSRF guard 403s for a bare mobile client
  /// (BACKEND_REFERENCE.md §1.3, "fix option 3" — a fragile stopgap, not a
  /// real fix). Must match a value in the backend's `allowedOrigins()`
  /// (its `NEXT_PUBLIC_APP_URL`). Remove this header entirely once the
  /// backend fix actually lands.
  static const String appOrigin = String.fromEnvironment(
    'APP_ORIGIN',
    defaultValue: 'https://www.batamart.com',
  );

  /// Web-application-type OAuth client ID — must match whatever the
  /// backend has configured as `GOOGLE_CLIENT_ID` (BACKEND_REFERENCE.md
  /// §3.1's `POST /api/auth/google`: the idToken's audience is checked
  /// against that value). This is deliberately NOT the Android-type OAuth
  /// client created for this app's package+SHA-1 (that one only authorizes
  /// the app to use Google Sign-In at all; it never appears in code).
  /// Override with:
  ///   flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=xxxx.apps.googleusercontent.com
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '451382163885-bh40g7p9bkull6i0btu8lpkuimi41t0a.apps.googleusercontent.com',
  );
}
