import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/ticket_host_models.dart';
import '../data/ticket_host_repository.dart';

export '../../../core/upload/upload_providers.dart'
    show uploadRepositoryProvider;

final ticketHostRepositoryProvider = Provider<TicketHostRepository>(
  (ref) => TicketHostRepository(),
);

final hostEventsProvider =
    FutureProvider.autoDispose<List<HostEventSummary>>((ref) {
  return ref.watch(ticketHostRepositoryProvider).fetchMyEvents();
});

final hostEventDetailProvider =
    FutureProvider.autoDispose.family<HostEventDetail, String>((ref, id) {
  return ref.watch(ticketHostRepositoryProvider).fetchEvent(id);
});

final myTicketListingsProvider =
    FutureProvider.autoDispose<List<TicketListingItem>>((ref) {
  return ref.watch(ticketHostRepositoryProvider).fetchMyListings();
});
