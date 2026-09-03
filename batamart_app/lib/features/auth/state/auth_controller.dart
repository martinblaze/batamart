import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/storage/token_storage.dart';
import '../data/auth_models.dart';
import '../data/auth_repository.dart';
import '../data/google_auth_service.dart';
import 'auth_state.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(),
);

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) {
    return AuthController(ref.watch(authRepositoryProvider));
  },
);

/// Single source of truth for "who's logged in as what" — the router's
/// redirect guard and every role-gated screen read this instead of poking
/// at a stored token directly.
class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repository)
    : super(const AuthState(status: AuthStatus.unknown)) {
    _bootstrap();
  }

  final AuthRepository _repository;

  Future<void> _bootstrap() async {
    final token = await TokenStorage.instance.readToken();
    if (token == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final user = await _repository.me();
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } on ApiException catch (e) {
      if (e.body?['suspended'] == true) {
        // Token itself is still valid — the account is administratively
        // blocked. Keep it (don't clear) so a lifted suspension resumes
        // the session without re-login; see BUILD_PLAN Phase 11.
        state = AuthState(
          status: AuthStatus.suspended,
          suspensionReason: e.body?['reason'] as String?,
          suspensionUntil: e.body?['until'] as String?,
        );
        return;
      }
      // Expired/invalid token — force re-login (BUILD_PLAN Phase 3 DoD).
      await TokenStorage.instance.clearToken();
      state = const AuthState(status: AuthStatus.unauthenticated);
    } catch (_) {
      await TokenStorage.instance.clearToken();
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> _completeAuth(AuthResult result) async {
    await TokenStorage.instance.saveToken(result.token);
    // Login/signup/google/rider-login responses return a slimmer `user`
    // object than `/api/auth/me` — e.g. login-with-password's response
    // omits `roomNumber`/`landmark` entirely (BACKEND_REFERENCE.md §3.1) —
    // so `hasDeliveryProfile` would read false for an account that already
    // has a complete delivery profile on file, forcing Profile Setup on
    // every login even though nothing is actually missing. Fetch the full
    // profile before flipping to `authenticated` so the router's redirect
    // guard never sees the stale/incomplete snapshot.
    AppUser user = result.user;
    try {
      user = await _repository.me();
    } catch (_) {
      // Fall back to the slim user rather than failing the whole login
      // flow on an unlikely me() hiccup immediately after a successful
      // auth call.
    }
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> loginWithPassword({
    required String email,
    required String password,
  }) async {
    final result = await _repository.loginWithPassword(
      email: email,
      password: password,
    );
    await _completeAuth(result);
  }

  Future<void> sendSignupOtp({required String email}) {
    return _repository.sendSignupOtp(email: email);
  }

  Future<String> verifySignupOtp({
    required String email,
    required String code,
  }) {
    return _repository.verifySignupOtp(email: email, code: code);
  }

  Future<void> completeSignup({
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
    final result = await _repository.signupWithPassword(
      email: email,
      name: name,
      password: password,
      otpSessionToken: otpSessionToken,
      phone: phone,
      universityId: universityId,
      hostelName: hostelName,
      roomNumber: roomNumber,
      landmark: landmark,
      referralCode: referralCode,
    );
    await _completeAuth(result);
  }

  Future<void> sendPasswordResetOtp({required String email}) {
    return _repository.sendLoginOtp(email: email);
  }

  Future<void> resetPassword({
    required String email,
    required String otpCode,
    required String newPassword,
  }) {
    return _repository.resetPassword(
      email: email,
      otpCode: otpCode,
      newPassword: newPassword,
    );
  }

  /// Runs the native Google Sign-In flow and exchanges the resulting ID
  /// token with the backend. On [GoogleAuthSuccess] this also completes
  /// auth (same as password login); on [GoogleSignupRequired] the caller
  /// is responsible for routing to a screen that collects the remaining
  /// signup fields and calls [completeSignup] with the returned
  /// `signupToken` as `otpSessionToken`.
  Future<GoogleAuthOutcome> continueWithGoogle({
    String? mode,
    String? universityId,
    String? referralCode,
  }) async {
    final idToken = await GoogleAuthService.instance.signIn();
    final outcome = await _repository.continueWithGoogle(
      idToken: idToken,
      mode: mode,
      universityId: universityId,
      referralCode: referralCode,
    );
    if (outcome is GoogleAuthSuccess) {
      await _completeAuth(outcome.result);
    }
    return outcome;
  }

  Future<void> riderLogin({
    required String email,
    required String password,
  }) async {
    final result = await _repository.riderLogin(
      email: email,
      password: password,
    );
    await _completeAuth(result);
  }

  Future<void> riderRegister({
    required String name,
    required String phone,
    required String email,
    required String password,
    required String idDocumentBase64,
    required String universityId,
  }) {
    return _repository.riderRegister(
      name: name,
      phone: phone,
      email: email,
      password: password,
      idDocumentBase64: idDocumentBase64,
      universityId: universityId,
    );
  }

  Future<void> becomeSeller() async {
    await _repository.becomeSeller();
    await refreshUser();
  }

  Future<void> toggleSellerMode({required bool isSellerMode}) async {
    await _repository.toggleSellerMode(isSellerMode: isSellerMode);
    final user = state.user;
    if (user != null) {
      state = state.copyWith(user: user.copyWith(isSellerMode: isSellerMode));
    }
  }

  Future<void> updateDeliveryProfile({
    required String hostelName,
    required String roomNumber,
    required String landmark,
  }) async {
    final user = await _repository.updateProfile(
      hostelName: hostelName,
      roomNumber: roomNumber,
      landmark: landmark,
    );
    state = state.copyWith(user: user);
  }

  /// General profile edit (name + delivery details) — used by the Profile
  /// tab's "Edit Profile" sheet. `PATCH /api/auth/update-profile`
  /// (BACKEND_REFERENCE.md §3.1) supports partial updates, so only the
  /// fields actually passed get sent.
  Future<void> updateProfile({
    String? name,
    String? phone,
    String? hostelName,
    String? roomNumber,
    String? landmark,
  }) async {
    final user = await _repository.updateProfile(
      name: name,
      phone: phone,
      hostelName: hostelName,
      roomNumber: roomNumber,
      landmark: landmark,
    );
    state = state.copyWith(user: user);
  }

  Future<void> refreshUser() async {
    final user = await _repository.me();
    state = state.copyWith(status: AuthStatus.authenticated, user: user);
  }

  /// Re-checks `me()` from the Suspended screen's "Refresh" action — if
  /// the suspension has since been lifted, `me()` now returns 200 and this
  /// resumes the session with no re-login needed (the token was never
  /// cleared). Reuses the same bootstrap logic since the check is
  /// identical.
  Future<void> retryAfterSuspension() => _bootstrap();

  Future<void> logout() async {
    await TokenStorage.instance.clearToken();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}
