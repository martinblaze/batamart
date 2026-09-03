import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/dispute_models.dart';
import '../data/disputes_repository.dart';
import '../data/reports_repository.dart';

final disputesRepositoryProvider = Provider<DisputesRepository>(
  (ref) => DisputesRepository(),
);
final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => ReportsRepository(),
);

final disputesProvider = FutureProvider.autoDispose<List<Dispute>>((ref) {
  return ref.watch(disputesRepositoryProvider).fetchDisputes();
});

final disputeDetailProvider = FutureProvider.autoDispose
    .family<Dispute, String>((ref, id) {
      return ref.watch(disputesRepositoryProvider).fetchDispute(id);
    });

final disputeMessagesProvider = FutureProvider.autoDispose
    .family<List<DisputeMessage>, String>((ref, disputeId) {
      return ref.watch(disputesRepositoryProvider).fetchMessages(disputeId);
    });
