import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/ticket_models.dart';
import '../data/tickets_repository.dart';

final ticketsRepositoryProvider = Provider<TicketsRepository>(
  (ref) => TicketsRepository(),
);

final eventsSearchProvider = StateProvider.autoDispose<String>((ref) => '');

final eventsProvider = FutureProvider.autoDispose<List<EventSummary>>((ref) {
  return ref
      .watch(ticketsRepositoryProvider)
      .fetchEvents(search: ref.watch(eventsSearchProvider));
});

/// Keyed by "eventId|ref" so a resale link shows its reseller.
final eventDetailProvider = FutureProvider.autoDispose
    .family<EventDetail, ({String id, String? ref})>((ref, key) {
      return ref
          .watch(ticketsRepositoryProvider)
          .fetchEvent(key.id, ref: key.ref);
    });

final myTicketsProvider = FutureProvider.autoDispose<List<MyTicket>>((ref) {
  return ref.watch(ticketsRepositoryProvider).fetchMine();
});
