import '../../../core/api/api_client.dart';
import 'ticket_models.dart';

/// Buyer-side ticketing API (docs/TICKETING.md section 5).
class TicketsRepository {
  final _api = ApiClient.instance;

  Future<List<EventSummary>> fetchEvents({String search = ''}) async {
    final r = await _api.get(
      '/api/tickets/events',
      queryParameters: {if (search.trim().isNotEmpty) 'search': search.trim()},
    );
    return (r['events'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => EventSummary.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  Future<EventDetail> fetchEvent(String id, {String? ref}) async {
    final r = await _api.get(
      '/api/tickets/events/$id',
      queryParameters: {if (ref != null && ref.isNotEmpty) 'ref': ref},
    );
    return EventDetail.fromJson(r);
  }

  /// A failure carries `ApiException.body['code']`: USERNAME_REQUIRED,
  /// INSUFFICIENT_BALANCE, PIN_REQUIRED, PIN_INVALID, and so on.
  Future<CheckoutResult> checkout({
    required String eventId,
    required String tierId,
    required int quantity,
    required String method,
    String? resellerId,
    String? pin,
  }) async {
    final r = await _api.post(
      '/api/tickets/checkout',
      data: {
        'eventId': eventId,
        'tierId': tierId,
        'quantity': quantity,
        'method': method,
        'resellerId': ?resellerId,
        'pin': ?pin,
      },
    );
    return CheckoutResult(
      authorizationUrl: r['authorizationUrl'] as String?,
      purchaseId: r['purchaseId'] as String?,
    );
  }

  Future<List<MyTicket>> fetchMine() async {
    final r = await _api.get('/api/tickets/mine');
    final live = (r['tickets'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => MyTicket.fromJson(e.cast<String, dynamic>()))
        .toList();
    // Paid purchases whose tickets were deleted after the event: shown as "Event ended".
    final ended = (r['endedPurchases'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => MyTicket.fromEndedPurchase(e.cast<String, dynamic>()))
        .toList();
    return [...live, ...ended];
  }

  Future<TicketDetail> fetchTicket(String id) async {
    final r = await _api.get('/api/tickets/ticket/$id');
    return TicketDetail.fromJson(r);
  }

  /// Returns the friend's display name, or null when no such user.
  Future<String?> lookupUser(String username) async {
    final r = await _api.get(
      '/api/tickets/lookup-user',
      queryParameters: {'username': username},
    );
    if (r['found'] != true) return null;
    return r['name'] as String? ?? username;
  }

  Future<void> transfer(String ticketId, String toUsername) async {
    await _api.post(
      '/api/tickets/ticket/$ticketId/transfer',
      data: {'toUsername': toUsername},
    );
  }
}
