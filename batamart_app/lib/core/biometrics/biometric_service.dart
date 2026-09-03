import 'package:local_auth/local_auth.dart';

/// Device biometric prompt (fingerprint/face unlock) for
/// biometric-confirmed wallet withdrawal — distinct from any future
/// biometric *login* shortcut (BUILD_PLAN Phase 8 vs. the Phase 3 note
/// that deferred login biometrics).
class BiometricService {
  final _auth = LocalAuthentication();

  Future<bool> isAvailable() async {
    try {
      final supported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      return supported && canCheck;
    } catch (_) {
      return false;
    }
  }

  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        persistAcrossBackgrounding: true,
      );
    } catch (_) {
      return false;
    }
  }
}
