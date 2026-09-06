import 'dart:convert';

/// Mirrors `decodeProductData` in `lib/variants.ts`.
///
/// Some listings do not store a human description at all: the web's older sell
/// flow packed `{variants, tags}` into `Product.description` as
/// `VARIANTS_V2::<base64-json>`, because there is no tags column on the
/// Product model. The web product page hides that blob and renders the decoded
/// tags instead; without the same handling the app shows raw base64 to buyers.
///
/// Older still are pipe-separated descriptions — `"Real text | tag | tag"` —
/// where only the first segment is prose.
class ProductDescription {
  const ProductDescription({required this.text, required this.tags});

  /// Prose to show, or empty when the field held only encoded data.
  final String text;

  /// Tags recovered from the encoding, for display where the web shows them.
  final List<String> tags;

  static const _prefix = 'VARIANTS_V2::';

  static ProductDescription parse(String? description) {
    final raw = description?.trim() ?? '';
    if (raw.isEmpty) return const ProductDescription(text: '', tags: []);

    if (raw.startsWith(_prefix)) {
      try {
        final decoded = jsonDecode(
          utf8.decode(base64Decode(raw.substring(_prefix.length))),
        );
        if (decoded is Map) {
          return ProductDescription(
            // Deliberately empty: the payload carries no prose, and echoing
            // the tag list as a sentence would read as a description the
            // seller never wrote.
            text: '',
            tags: (decoded['tags'] as List? ?? const [])
                .map((e) => e.toString().trim())
                .where((e) => e.isNotEmpty)
                .toList(),
          );
        }
      } catch (_) {
        // Corrupt payload: fall through and show nothing rather than base64.
      }
      return const ProductDescription(text: '', tags: []);
    }

    if (raw.contains(' | ')) {
      final parts = raw.split(' | ').map((e) => e.trim()).where((e) => e.isNotEmpty);
      return ProductDescription(
        text: parts.isEmpty ? '' : parts.first,
        tags: parts.skip(1).toList(),
      );
    }

    return ProductDescription(text: raw, tags: const []);
  }
}
