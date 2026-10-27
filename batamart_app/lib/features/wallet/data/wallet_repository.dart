import '../../../core/api/api_client.dart';
import 'wallet_models.dart';

/// Wallet domain (BACKEND_REFERENCE.md §3.7). Same screen/data source for
/// all three roles — RIDER just gets an "Earnings" label swap client-side
/// (§3.7 doesn't differentiate the response by role beyond `role` itself).
class WalletRepository {
  final _api = ApiClient.instance;

  Future<Wallet> fetchWallet() async {
    final response = await _api.get('/api/wallet');
    return Wallet.fromJson(response['wallet'] as Map<String, dynamic>);
  }

  Future<List<WalletTransaction>> fetchTransactions({
    int page = 1,
    int limit = 50,
  }) async {
    final response = await _api.get(
      '/api/wallet/transactions',
      queryParameters: {'page': page, 'limit': limit},
    );
    return (response['transactions'] as List? ?? const [])
        .whereType<Map>()
        .map((t) => WalletTransaction.fromJson(t.cast<String, dynamic>()))
        .toList();
  }

  /// Starts a Flutterwave top-up and returns the hosted payment URL. The
  /// server credits the wallet once Flutterwave confirms the payment.
  Future<String> startTopUp(int amount) async {
    final response = await _api.post(
      '/api/wallet/topup',
      data: {'amount': amount},
    );
    return response['authorizationUrl'] as String;
  }

  /// Three branches per §3.7: first-time set (neither param), change (via
  /// `currentPin`), forgot-PIN (via `otpCode`).
  Future<void> setPin({
    required String pin,
    String? currentPin,
    String? otpCode,
  }) {
    return _api.post(
      '/api/wallet/set-pin',
      data: {'pin': pin, 'currentPin': ?currentPin, 'otpCode': ?otpCode},
    );
  }

  /// Step 1 of "forgot PIN" — emails a fresh OTP; follow with [setPin]
  /// passing that `otpCode`.
  Future<void> requestPinResetOtp() {
    return _api.post('/api/wallet/reset-pin');
  }

  /// UX-only check (§3.7 — doesn't gate `withdraw`, which re-verifies
  /// independently every time).
  Future<void> verifyPin(String pin) {
    return _api.post('/api/wallet/verify-pin', data: {'pin': pin});
  }

  Future<String> withdraw({
    required int amount,
    required String bankCode,
    required String accountNumber,
    required String accountName,
    required String pin,
    String source = 'MAIN',
  }) async {
    final idempotencyKey = 'wd-${DateTime.now().microsecondsSinceEpoch}';
    final response = await _api.post(
      '/api/wallet/withdraw',
      data: {
        'amount': amount,
        'bankCode': bankCode,
        'accountNumber': accountNumber,
        'accountName': accountName,
        'pin': pin,
        'source': source,
        'idempotencyKey': idempotencyKey,
      },
    );
    return response['reference'] as String? ?? '';
  }
}
