/// One row of `GET /api/category-attributes?categoryKey=&subcategoryKey=`.
///
/// These are the "Category Details" the web sell form renders under step 4 —
/// structured, per-category fields (Brand, Storage, Size…) that drive search
/// filters and, when the seller picks more than one value, the product's
/// variants.
///
/// The endpoint hydrates `options` server-side before returning: for a
/// select/multi_select with no curated options it merges the most common values
/// other sellers have used (`AttributeValueStats`), the category's variant-field
/// suggestions, and a brand fallback list. So `options` is authoritative here
/// and the app never needs its own suggestion source.
class CategoryAttributeDef {
  const CategoryAttributeDef({
    required this.key,
    required this.label,
    required this.type,
    required this.options,
    required this.required,
    required this.filterable,
    required this.searchable,
    required this.sortOrder,
  });

  final String key;
  final String label;

  /// `text` | `select` | `multi_select` | `number` | `boolean`. Kept as a raw
  /// string rather than an enum: the values come from a database table an admin
  /// can extend, and an unknown type must degrade to a plain text field rather
  /// than crash the sell flow.
  final String type;

  final List<String> options;
  final bool required;
  final bool filterable;
  final bool searchable;
  final int sortOrder;

  /// Only these two types can produce variants — a free-text or numeric field
  /// has no notion of "the seller picked several of these".
  bool get isChoice => type == 'select' || type == 'multi_select';

  /// `multi_select` is the only type that holds more than one value at a time,
  /// but a `select` still becomes a variant axis in the web form once several
  /// values are chosen, so both are treated as multi-valued here.
  bool get allowsMultiple => isChoice;

  factory CategoryAttributeDef.fromJson(Map<String, dynamic> json) {
    return CategoryAttributeDef(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? json['key'] as String? ?? '',
      type: json['type'] as String? ?? 'text',
      options:
          (json['options'] as List?)
              ?.map((e) => e.toString())
              .where((e) => e.isNotEmpty)
              .toList() ??
          const [],
      required: json['required'] as bool? ?? false,
      filterable: json['filterable'] as bool? ?? true,
      searchable: json['searchable'] as bool? ?? true,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}
