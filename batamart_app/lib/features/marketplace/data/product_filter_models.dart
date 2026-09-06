/// Response of `GET /api/product-filters`.
///
/// The endpoint is what makes the app's filters match the web's: it counts
/// every *filterable* attribute value across the products currently in scope
/// AND every key found in those products' variant combinations, then merges
/// the two. So a listing whose sizes exist only as variants still contributes
/// a "Size" filter, which a client deriving filters from attributes alone
/// would miss.
class ProductFilters {
  const ProductFilters({
    required this.filters,
    required this.priceMin,
    required this.priceMax,
  });

  final List<ProductFilterDef> filters;
  final double priceMin;
  final double priceMax;

  static const empty = ProductFilters(
    filters: [],
    priceMin: 0,
    priceMax: 0,
  );

  factory ProductFilters.fromJson(Map<String, dynamic> json) {
    final price = json['price'] as Map<String, dynamic>? ?? const {};
    return ProductFilters(
      filters:
          (json['filters'] as List? ?? const [])
              .whereType<Map>()
              .map((e) => ProductFilterDef.fromJson(e.cast<String, dynamic>()))
              .where((f) => f.key.isNotEmpty && f.options.isNotEmpty)
              .toList(),
      priceMin: (price['min'] as num?)?.toDouble() ?? 0,
      priceMax: (price['max'] as num?)?.toDouble() ?? 0,
    );
  }
}

class ProductFilterDef {
  const ProductFilterDef({
    required this.key,
    required this.label,
    required this.type,
    required this.source,
    required this.options,
    required this.selectedValues,
  });

  final String key;
  final String label;

  /// `select` | `multi_select` | `boolean` | `range`. Everything the app
  /// renders today is a value list, so this is carried for fidelity with the
  /// API rather than branched on.
  final String type;

  /// `attribute` (declared as a Category Detail), `variant` (found only in
  /// product variant combinations), or `merged` (both).
  final String source;

  final List<ProductFilterOption> options;
  final List<String> selectedValues;

  factory ProductFilterDef.fromJson(Map<String, dynamic> json) {
    return ProductFilterDef(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? json['key'] as String? ?? '',
      type: json['type'] as String? ?? 'multi_select',
      source: json['source'] as String? ?? 'attribute',
      options:
          (json['options'] as List? ?? const [])
              .whereType<Map>()
              .map(
                (e) => ProductFilterOption.fromJson(e.cast<String, dynamic>()),
              )
              .where((o) => o.value.isNotEmpty)
              .toList(),
      selectedValues:
          (json['selectedValues'] as List? ?? const [])
              .map((e) => e.toString())
              .toList(),
    );
  }
}

class ProductFilterOption {
  const ProductFilterOption({required this.value, required this.count});

  final String value;

  /// How many in-scope products carry this value — shown beside the option so
  /// a filter that would empty the grid is visible before it is tapped.
  final int count;

  factory ProductFilterOption.fromJson(Map<String, dynamic> json) {
    return ProductFilterOption(
      value: json['value']?.toString() ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}
