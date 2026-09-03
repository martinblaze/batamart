/// University.hostels / University.deliveryAreas are raw, unasserted JSON
/// (BACKEND_REFERENCE.md §2, §3.2 — "this route doesn't assert their
/// internal array/object shape"). Normalizes whatever comes back into a
/// flat string list a dropdown can use; callers fall back to a free-text
/// field when this returns empty.
List<String> extractPicklist(dynamic raw) {
  if (raw is! List) return const [];

  return raw
      .map((item) {
        if (item is String) return item;
        if (item is Map) {
          final candidate = item['name'] ?? item['label'] ?? item['value'];
          if (candidate != null) return candidate.toString();
        }
        return item.toString();
      })
      .where((s) => s.isNotEmpty)
      .toList();
}
