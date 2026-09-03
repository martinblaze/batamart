import '../../../core/api/api_client.dart';
import 'dispute_models.dart';

/// Disputes domain (BACKEND_REFERENCE.md §3.9). The message thread
/// (`.../messages`) is buyer-or-admin only — a seller gets a 403 from
/// those two routes even though they can read the dispute record itself
/// via [fetchDispute]. Never call `fetchMessages`/`sendMessage` for a
/// seller-viewed dispute.
class DisputesRepository {
  final _api = ApiClient.instance;

  Future<List<Dispute>> fetchDisputes() async {
    final response = await _api.get('/api/disputes');
    return (response['disputes'] as List? ?? const [])
        .whereType<Map>()
        .map((d) => Dispute.fromJson(d.cast<String, dynamic>()))
        .toList();
  }

  Future<Dispute> fetchDispute(String id) async {
    final response = await _api.get('/api/disputes/$id');
    return Dispute.fromJson(response['dispute'] as Map<String, dynamic>);
  }

  /// Buyer-only (403 for sellers/riders per §3.9).
  Future<Dispute> openDispute({
    required String orderId,
    required String reason,
    required String description,
    required List<String> evidence,
    Map<String, dynamic>? pickupAddress,
  }) async {
    final response = await _api.post(
      '/api/disputes',
      data: {
        'orderId': orderId,
        'reason': reason,
        'description': description,
        'evidence': evidence,
        'pickupAddress': ?pickupAddress,
      },
    );
    return Dispute.fromJson(response['dispute'] as Map<String, dynamic>);
  }

  Future<List<DisputeMessage>> fetchMessages(String disputeId) async {
    final response = await _api.get('/api/disputes/$disputeId/messages');
    return (response['messages'] as List? ?? const [])
        .whereType<Map>()
        .map((m) => DisputeMessage.fromJson(m.cast<String, dynamic>()))
        .toList();
  }

  Future<void> sendMessage(
    String disputeId,
    String message, {
    List<String> attachments = const [],
  }) {
    return _api.post(
      '/api/disputes/$disputeId/messages',
      data: {'message': message, 'attachments': attachments},
    );
  }

  /// Seller-only, despite the generic name (§3.9) — confirms the rider
  /// delivered the returned item back to them.
  Future<void> confirmReturn(String disputeId) {
    return _api.post('/api/disputes/$disputeId/confirm-return');
  }
}
