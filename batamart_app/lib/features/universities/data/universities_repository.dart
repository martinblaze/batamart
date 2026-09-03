import '../../../core/api/api_client.dart';

/// Phase 1 API-wiring proof only. GET /api/universities is unauthenticated
/// and low-risk (BACKEND_REFERENCE.md §3.2) — used here purely to confirm
/// the Dio setup reaches the real backend end to end. The signup/onboarding
/// picklists that actually consume this data land in Phase 3.
class UniversitiesRepository {
  Future<List<Map<String, dynamic>>> fetchUniversities() async {
    final response = await ApiClient.instance.get('/api/universities');
    final universities = response['universities'];
    if (universities is List) {
      return universities.cast<Map<String, dynamic>>();
    }
    return const [];
  }
}
