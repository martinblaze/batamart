import 'package:geolocator/geolocator.dart';

import '../../../core/api/api_client.dart';
import '../../../core/config/env.dart';
import 'auth_models.dart';

/// Wraps every `/api/auth/*` and `/api/riders/{login,register}` call
/// documented in BACKEND_REFERENCE.md §3.1 / §5.9.
///
/// The 5 routes flagged in §1.3 (`login-with-password`, `send-otp`,
/// `reset-password`, `riders/login`, `riders/register`) 403 from a bare
/// mobile client because the backend's `enforceSameOrigin` CSRF guard has
/// no Bearer token to exempt them with yet. Per the user's own call (no
/// backend fix landed yet), this repo applies fix option 3 from that
/// section: manually set `Origin: Env.appOrigin` on just those calls. This
/// is a documented stopgap, not a real fix — it silently breaks if the
/// backend's allowed-origin config changes. Remove the `headers` argument
/// on each call below once the backend fix lands.
class AuthRepository {
  final _api = ApiClient.instance;

  Map<String, dynamic> get _originHeader => {'Origin': Env.appOrigin};

  String? _locationToken;
  DateTime? _locationTokenAt;

  /// Batamart signup is Awka-only. The backend wants a short-lived token
  /// proving a GPS fix inside Awka on `send-otp` (signup), `google` (signup)
  /// and `signup-with-password`. Cached for 50 min (token lives 60).
  Future<String> _ensureLocationToken() async {
    final cached = _locationToken;
    final at = _locationTokenAt;
    if (cached != null &&
        at != null &&
        DateTime.now().difference(at) < const Duration(minutes: 50)) {
      return cached;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw const LocationProofException(
        'Please allow location access. Batamart is only open to people in Awka, and we need to confirm you are there.',
      );
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationProofException(
        'Turn on your phone location so we can confirm you are in Awka.',
      );
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
    final response = await _api.post(
      '/api/auth/verify-location',
      data: {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracy': position.accuracy,
      },
      headers: _originHeader,
    );
    final token = response['locationToken'] as String;
    _locationToken = token;
    _locationTokenAt = DateTime.now();
    return token;
  }

  Future<AuthResult> loginWithPassword({
    required String email,
    required String password,
  }) async {
    final response = await _api.post(
      '/api/auth/login-with-password',
      data: {'email': email, 'password': password},
      headers: _originHeader,
    );
    return AuthResult(
      token: response['token'] as String,
      user: AppUser.fromJson(response['user'] as Map<String, dynamic>),
    );
  }

  /// No `name` — signup flow. Returns an `otpSessionToken` to pass into
  /// [signupWithPassword].
  Future<String> sendSignupOtp({required String email}) async {
    final locationToken = await _ensureLocationToken();
    await _api.post(
      '/api/auth/send-otp',
      data: {'email': email, 'isLogin': false, 'locationToken': locationToken},
      headers: _originHeader,
    );
    return email;
  }

  Future<String> sendLoginOtp({required String email}) async {
    await _api.post(
      '/api/auth/send-otp',
      data: {'email': email, 'isLogin': true},
      headers: _originHeader,
    );
    return email;
  }

  /// Signup flow (no `name` in the body) — exchanges the emailed code for
  /// an `otpSessionToken` to pass into [signupWithPassword].
  Future<String> verifySignupOtp({
    required String email,
    required String code,
  }) async {
    final response = await _api.post(
      '/api/auth/verify-otp',
      data: {'email': email, 'code': code},
    );
    return response['otpSessionToken'] as String;
  }

  Future<AuthResult> signupWithPassword({
    required String email,
    required String name,
    required String password,
    required String otpSessionToken,
    required String phone,
    required String universityId,
    required String hostelName,
    required String roomNumber,
    required String landmark,
    String? referralCode,
  }) async {
    final locationToken = await _ensureLocationToken();
    final response = await _api.post(
      '/api/auth/signup-with-password',
      data: {
        'locationToken': locationToken,
        'email': email,
        'name': name,
        'password': password,
        'otpSessionToken': otpSessionToken,
        'phone': phone,
        'universityId': universityId,
        'hostelName': hostelName,
        'roomNumber': roomNumber,
        'landmark': landmark,
        if (referralCode != null && referralCode.isNotEmpty)
          'referralCode': referralCode,
      },
    );
    return AuthResult(
      token: response['token'] as String,
      user: AppUser.fromJson(response['user'] as Map<String, dynamic>),
    );
  }

  /// `send-otp` -> user reads the code -> straight into this. Do NOT call
  /// `verify-otp` first — it consumes the same single-use OTP row and this
  /// call would then 400 (BACKEND_REFERENCE.md §3.1).
  Future<void> resetPassword({
    required String email,
    required String otpCode,
    required String newPassword,
  }) {
    return _api.post(
      '/api/auth/reset-password',
      data: {'email': email, 'otpCode': otpCode, 'newPassword': newPassword},
      headers: _originHeader,
    );
  }

  /// `mode: 'signup'` on a brand-new Google account doesn't create a user
  /// yet — it returns a short-lived `signupToken` + basic profile instead,
  /// which the caller must feed into [signupWithPassword] along with the
  /// rest of the normal signup fields (BACKEND_REFERENCE.md §3.1).
  Future<GoogleAuthOutcome> continueWithGoogle({
    required String idToken,
    String? mode,
    String? universityId,
    String? referralCode,
  }) async {
    final locationToken = mode == 'signup' ? await _ensureLocationToken() : null;
    final response = await _api.post(
      '/api/auth/google',
      data: {
        'idToken': idToken,
        'locationToken': ?locationToken,
        'mode': ?mode,
        'universityId': ?universityId,
        'referralCode': ?referralCode,
      },
    );
    if (response['requiresProfile'] == true) {
      final profile = response['profile'] as Map<String, dynamic>;
      return GoogleSignupRequired(
        signupToken: response['signupToken'] as String,
        email: profile['email'] as String,
        name: profile['name'] as String?,
      );
    }
    return GoogleAuthSuccess(
      AuthResult(
        token: response['token'] as String,
        user: AppUser.fromJson(response['user'] as Map<String, dynamic>),
      ),
    );
  }

  Future<AppUser> me() async {
    final response = await _api.get('/api/auth/me');
    return AppUser.fromJson(response['user'] as Map<String, dynamic>);
  }

  /// Prefer this over `PUT /api/auth/profile` per BACKEND_REFERENCE.md
  /// §3.1 — more complete, zod-validated, partial-update friendly.
  Future<AppUser> updateProfile({
    String? name,
    String? phone,
    String? hostelName,
    String? roomNumber,
    String? landmark,
    String? username,
  }) async {
    final response = await _api.patch(
      '/api/auth/update-profile',
      data: {
        'name': ?name,
        'phone': ?phone,
        'hostelName': ?hostelName,
        'roomNumber': ?roomNumber,
        'landmark': ?landmark,
        'username': ?username,
      },
    );
    return AppUser.fromJson(response['user'] as Map<String, dynamic>);
  }

  Future<void> toggleSellerMode({required bool isSellerMode}) {
    return _api.post(
      '/api/auth/toggle-seller-mode',
      data: {'isSellerMode': isSellerMode},
    );
  }

  Future<void> becomeSeller() {
    return _api.post('/api/auth/become-seller');
  }

  Future<AuthResult> riderLogin({
    required String email,
    required String password,
  }) async {
    final response = await _api.post(
      '/api/riders/login',
      data: {'email': email, 'password': password},
      headers: _originHeader,
    );
    return AuthResult(
      token: response['token'] as String,
      user: AppUser.fromJson(response['user'] as Map<String, dynamic>),
    );
  }

  /// Registration alone does not log the rider in — `isRiderVerified` is
  /// false until an out-of-scope admin process approves them
  /// (BACKEND_REFERENCE.md §5.9).
  Future<void> riderRegister({
    required String name,
    required String phone,
    required String email,
    required String password,
    required String idDocumentBase64,
    required String universityId,
  }) {
    return _api.post(
      '/api/riders/register',
      data: {
        'name': name,
        'phone': phone,
        'email': email,
        'password': password,
        'idDocument': idDocumentBase64,
        'universityId': universityId,
      },
      headers: _originHeader,
    );
  }
}

/// Thrown when we cannot even attempt the Awka location check (permission
/// refused, location off). Carries a user-facing message.
class LocationProofException implements Exception {
  const LocationProofException(this.message);
  final String message;

  @override
  String toString() => message;
}
