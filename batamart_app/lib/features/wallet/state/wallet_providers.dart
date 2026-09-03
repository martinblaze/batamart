import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/biometrics/biometric_service.dart';
import '../data/wallet_models.dart';
import '../data/wallet_repository.dart';

final walletRepositoryProvider = Provider<WalletRepository>(
  (ref) => WalletRepository(),
);
final biometricServiceProvider = Provider<BiometricService>(
  (ref) => BiometricService(),
);

final walletProvider = FutureProvider.autoDispose<Wallet>((ref) {
  return ref.watch(walletRepositoryProvider).fetchWallet();
});

final walletTransactionsProvider =
    FutureProvider.autoDispose<List<WalletTransaction>>((ref) {
      return ref.watch(walletRepositoryProvider).fetchTransactions();
    });
