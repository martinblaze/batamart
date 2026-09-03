import '../../../core/api/api_client.dart';

/// `POST /api/reports` (BACKEND_REFERENCE.md §3.9) — purely informational
/// for admin review; does not create a Dispute or Penalty. Reason values
/// aren't validated server-side against this list (an invalid value 500s
/// at the Prisma layer), but these are the documented suggested values.
const kReportReasons = [
  'FAKE_PRODUCT',
  'WRONG_DESCRIPTION',
  'POOR_QUALITY',
  'DELAYED_DELIVERY',
  'RUDE_BEHAVIOR',
  'SCAM',
  'INAPPROPRIATE_CONTENT',
  'PAYMENT_ISSUE',
  'OTHER',
];

class ReportsRepository {
  final _api = ApiClient.instance;

  Future<String> submitReport({
    required String type,
    required String reason,
    required String description,
    List<String> evidence = const [],
    String? reportedUserId,
    String? reportedProductId,
    String? reportedOrderId,
  }) async {
    final response = await _api.post(
      '/api/reports',
      data: {
        'type': type,
        'reason': reason,
        'description': description,
        'evidence': evidence,
        'reportedUserId': ?reportedUserId,
        'reportedProductId': ?reportedProductId,
        'reportedOrderId': ?reportedOrderId,
      },
    );
    return response['reportId'] as String? ?? '';
  }
}
