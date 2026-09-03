import '../../../core/utils/json_parsing.dart';

/// Result of any call that returns a token + user (login/signup/google/
/// riders-login) — the shapes differ slightly per endpoint but all three
/// give us these two things.
class AuthResult {
  const AuthResult({required this.token, required this.user});

  final String token;
  final AppUser user;
}

/// Result of `POST /api/auth/google` (BACKEND_REFERENCE.md §3.1) — either
/// an existing account logs straight in ([GoogleAuthSuccess]), or a
/// first-time Google user needs to complete the normal signup fields
/// (password, university, hostel...) before an account actually exists
/// ([GoogleSignupRequired]).
sealed class GoogleAuthOutcome {}

class GoogleAuthSuccess extends GoogleAuthOutcome {
  GoogleAuthSuccess(this.result);
  final AuthResult result;
}

class GoogleSignupRequired extends GoogleAuthOutcome {
  GoogleSignupRequired({required this.signupToken, required this.email, this.name});
  final String signupToken;
  final String email;
  final String? name;
}

/// Mirrors `GET /api/auth/me`'s `user` object (BACKEND_REFERENCE.md §3.1),
/// the single source of truth for role/isSellerMode client-side — never
/// decode the JWT for that. Every field is nullable/defaulted since the
/// slimmer `user` objects returned by login/signup/google omit most of
/// these (see each endpoint's 200 response shape).
class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.matricNumber,
    this.profilePhoto,
    this.role = 'BUYER',
    this.isSellerMode = true,
    this.hostelName,
    this.roomNumber,
    this.landmark,
    this.trustLevel = 'BRONZE',
    this.rating = 0,
    this.totalRatings = 0,
    this.completedOrders = 0,
    this.pendingBalance = 0,
    this.availableBalance = 0,
    this.penaltyPoints = 0,
    this.isSuspended = false,
    this.suspendedUntil,
    this.isRiderVerified = false,
    this.isAvailable = false,
    this.hasWithdrawalPin = false,
    this.universityId,
    this.university,
  });

  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? matricNumber;
  final String? profilePhoto;
  final String role;
  final bool isSellerMode;
  final String? hostelName;
  final String? roomNumber;
  final String? landmark;
  final String trustLevel;
  final double rating;
  final int totalRatings;
  final int completedOrders;
  final double pendingBalance;
  final double availableBalance;
  final int penaltyPoints;
  final bool isSuspended;
  final String? suspendedUntil;
  final bool isRiderVerified;
  final bool isAvailable;
  final bool hasWithdrawalPin;
  final String? universityId;
  final UniversityInfo? university;

  bool get isBuyer => role == 'BUYER';
  bool get isSeller => role == 'SELLER';
  bool get isRider => role == 'RIDER';

  /// True once hostel/room/landmark are all on file — Profile Setup is
  /// required before checkout until this is true (BUILD_PLAN Phase 3).
  bool get hasDeliveryProfile =>
      (hostelName?.isNotEmpty ?? false) &&
      (roomNumber?.isNotEmpty ?? false) &&
      (landmark?.isNotEmpty ?? false);

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      matricNumber: json['matricNumber'] as String?,
      profilePhoto: json['profilePhoto'] as String?,
      role: json['role'] as String? ?? 'BUYER',
      isSellerMode: json['isSellerMode'] as bool? ?? true,
      hostelName: json['hostelName'] as String?,
      roomNumber: json['roomNumber'] as String?,
      landmark: json['landmark'] as String?,
      trustLevel: json['trustLevel'] as String? ?? 'BRONZE',
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      totalRatings: json['totalRatings'] as int? ?? 0,
      completedOrders: json['completedOrders'] as int? ?? 0,
      pendingBalance: parseBalance(json['pendingBalance']),
      availableBalance: parseBalance(json['availableBalance']),
      penaltyPoints: json['penaltyPoints'] as int? ?? 0,
      isSuspended: json['isSuspended'] as bool? ?? false,
      suspendedUntil: json['suspendedUntil'] as String?,
      isRiderVerified: json['isRiderVerified'] as bool? ?? false,
      isAvailable: json['isAvailable'] as bool? ?? false,
      hasWithdrawalPin: json['hasWithdrawalPin'] as bool? ?? false,
      universityId: json['universityId'] as String?,
      university: json['university'] is Map<String, dynamic>
          ? UniversityInfo.fromJson(json['university'] as Map<String, dynamic>)
          : null,
    );
  }

  AppUser copyWith({
    String? hostelName,
    String? roomNumber,
    String? landmark,
    bool? isSellerMode,
    String? role,
  }) {
    return AppUser(
      id: id,
      name: name,
      phone: phone,
      email: email,
      matricNumber: matricNumber,
      profilePhoto: profilePhoto,
      role: role ?? this.role,
      isSellerMode: isSellerMode ?? this.isSellerMode,
      hostelName: hostelName ?? this.hostelName,
      roomNumber: roomNumber ?? this.roomNumber,
      landmark: landmark ?? this.landmark,
      trustLevel: trustLevel,
      rating: rating,
      totalRatings: totalRatings,
      completedOrders: completedOrders,
      pendingBalance: pendingBalance,
      availableBalance: availableBalance,
      penaltyPoints: penaltyPoints,
      isSuspended: isSuspended,
      suspendedUntil: suspendedUntil,
      isRiderVerified: isRiderVerified,
      isAvailable: isAvailable,
      hasWithdrawalPin: hasWithdrawalPin,
      universityId: universityId,
      university: university,
    );
  }
}

/// Nested `university` object on `/api/auth/me`'s response (BACKEND_REFERENCE.md
/// §3.1). `hostels`/`deliveryAreas` are raw, unasserted JSON — see
/// `core/utils/picklist.dart`.
class UniversityInfo {
  const UniversityInfo({
    required this.id,
    required this.name,
    this.shortName,
    this.slug,
    this.location,
    this.deliveryAreas,
    this.hostels,
  });

  final String id;
  final String name;
  final String? shortName;
  final String? slug;
  final String? location;
  final dynamic deliveryAreas;
  final dynamic hostels;

  factory UniversityInfo.fromJson(Map<String, dynamic> json) {
    return UniversityInfo(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      shortName: json['shortName'] as String?,
      slug: json['slug'] as String?,
      location: json['location'] as String?,
      deliveryAreas: json['deliveryAreas'],
      hostels: json['hostels'],
    );
  }
}
