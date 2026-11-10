import '../../../core/api/api_client.dart';
import 'ticket_host_models.dart';

/// Host and resale endpoints of the ticketing API (docs/TICKETING.md section 5).
class TicketHostRepository {
  final _api = ApiClient.instance;

  // ---- Host ----------------------------------------------------------

  Future<List<HostEventSummary>> fetchMyEvents() async {
    final r = await _api.get('/api/tickets/host/events');
    return (r['events'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => HostEventSummary.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  Future<HostEventDetail> fetchEvent(String id) async {
    final r = await _api.get('/api/tickets/host/events/$id');
    return HostEventDetail.fromJson(r);
  }

  Future<String> createEvent({
    required String name,
    required String description,
    required String venue,
    required String address,
    required DateTime startsAt,
    DateTime? endsAt,
    required String flyerUrl,
    required bool allowResale,
    required List<NewTierPayload> tiers,
    required List<String> checkerEmails,
    required List<String> sellerUsernames,
  }) async {
    final r = await _api.post(
      '/api/tickets/host/events',
      data: {
        'name': name,
        if (description.isNotEmpty) 'description': description,
        'venue': venue,
        if (address.isNotEmpty) 'address': address,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': ?endsAt?.toUtc().toIso8601String(),
        'flyerUrl': flyerUrl,
        'allowResale': allowResale,
        'tiers': tiers.map((t) => t.toJson()).toList(),
        if (checkerEmails.isNotEmpty) 'checkerEmails': checkerEmails,
        if (sellerUsernames.isNotEmpty) 'sellerUsernames': sellerUsernames,
      },
    );
    return '${r['id']}';
  }

  /// Event-field edit. Per section 7 an event without paid tickets goes back
  /// to review when name/venue/dates change.
  Future<void> updateEvent(String id, Map<String, dynamic> fields) {
    return _api.patch('/api/tickets/host/events/$id', data: fields);
  }

  /// Withdraw a flyer/description change that is still waiting for admin approval.
  Future<void> cancelPendingChange(String eventId) {
    return _api.delete('/api/tickets/host/events/$eventId/pending-change');
  }

  Future<void> updateTier(
    String eventId,
    String tierId, {
    required int price,
    required int capacity,
    required int randomCommissionPct,
    required int uniqueCommissionPct,
    DateTime? saleStartsAt,
    DateTime? saleEndsAt,
    bool? isActive,
  }) {
    return _api.patch(
      '/api/tickets/host/events/$eventId',
      data: {
        'tiers': [
          {
            'id': tierId,
            'isActive': ?isActive,
            'price': price,
            'capacity': capacity,
            'randomCommissionPct': randomCommissionPct,
            'uniqueCommissionPct': uniqueCommissionPct,
            'saleStartsAt': saleStartsAt?.toUtc().toIso8601String(),
            'saleEndsAt': saleEndsAt?.toUtc().toIso8601String(),
          },
        ],
      },
    );
  }

  /// A tier without `id` in PATCH `tiers` is created (needs name, price, capacity).
  Future<void> addTier(String eventId, NewTierPayload tier) {
    return _api.patch(
      '/api/tickets/host/events/$eventId',
      data: {
        'tiers': [tier.toJson()],
      },
    );
  }

  Future<void> addChecker(String eventId, String email, {String? name}) {
    return _api.post(
      '/api/tickets/host/events/$eventId/checkers',
      data: {'email': email, if (name != null && name.isNotEmpty) 'name': name},
    );
  }

  Future<void> resendChecker(String eventId, String checkerId) {
    return _api.post('/api/tickets/host/events/$eventId/checkers/$checkerId/resend');
  }

  Future<void> deactivateChecker(String eventId, String checkerId) {
    return _api.delete('/api/tickets/host/events/$eventId/checkers/$checkerId');
  }

  Future<void> addSeller(String eventId, String username) {
    return _api.post(
      '/api/tickets/host/events/$eventId/sellers',
      data: {'username': username},
    );
  }

  Future<void> removeSeller(String eventId, String rowId) {
    return _api.delete('/api/tickets/host/events/$eventId/sellers/$rowId');
  }

  Future<AuditPage> fetchAudit(String eventId, {String? cursor}) async {
    final r = await _api.get(
      '/api/tickets/host/events/$eventId/audit',
      queryParameters: {'cursor': ?cursor},
    );
    return AuditPage.fromJson(r);
  }

  Future<void> cancelEvent(String eventId) {
    return _api.post(
      '/api/tickets/host/events/$eventId/cancel',
      data: {'confirm': true},
    );
  }

  // ---- Resale --------------------------------------------------------

  Future<List<TicketListingItem>> fetchMyListings() async {
    final r = await _api.get('/api/tickets/listings/mine');
    return (r['listings'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => TicketListingItem.fromJson(e.cast<String, dynamic>()))
        .toList();
  }

  Future<void> startReselling(String eventId) {
    return _api.post('/api/tickets/listings', data: {'eventId': eventId});
  }

  Future<void> deactivateListing(String listingId) {
    return _api.delete('/api/tickets/listings/$listingId');
  }
}
