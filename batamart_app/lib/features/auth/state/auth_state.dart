import '../data/auth_models.dart';

enum AuthStatus {
  /// Still checking stored token / calling `me()` on app start.
  unknown,
  unauthenticated,
  authenticated,

  /// A *stored, still-valid* token belongs to a now-suspended account —
  /// `GET /api/auth/me` 403s with `{ suspended: true, reason, until }`
  /// instead of the normal 200 (BACKEND_REFERENCE.md §3.1) whenever this
  /// happens on bootstrap. Distinct from `unauthenticated`: the token
  /// itself isn't invalid, the account is administratively blocked, so
  /// silently bouncing to the login screen with no explanation would be
  /// misleading (BUILD_PLAN Phase 11 — suspension banners).
  suspended,
}

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.suspensionReason,
    this.suspensionUntil,
  });

  final AuthStatus status;
  final AppUser? user;
  final String? suspensionReason;
  final String? suspensionUntil;

  bool get isBootstrapping => status == AuthStatus.unknown;
  bool get isAuthenticated =>
      status == AuthStatus.authenticated && user != null;

  AuthState copyWith({
    AuthStatus? status,
    AppUser? user,
    String? suspensionReason,
    String? suspensionUntil,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      suspensionReason: suspensionReason ?? this.suspensionReason,
      suspensionUntil: suspensionUntil ?? this.suspensionUntil,
    );
  }
}
