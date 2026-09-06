import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/product_filter_models.dart';

import '../data/product_models.dart';
import '../data/products_repository.dart';

final productsRepositoryProvider = Provider<ProductsRepository>(
  (ref) => ProductsRepository(),
);

final productFeedProvider = FutureProvider.autoDispose<ProductFeed>((ref) {
  return ref.watch(productsRepositoryProvider).fetchFeed();
});

/// Search/filter query params — read by [productSearchProvider], written
/// by the Deals/Search screens' filter UI.
class ProductSearchQuery {
  const ProductSearchQuery({
    this.query,
    this.category,
    this.categoryKey,
    this.subcategoryKey,
    this.zone,
    this.sortBy = 'relevance',
    this.minPrice,
    this.maxPrice,
    this.minRating,
    this.inStock = false,
    this.fastDeliveryOnly = false,
    this.attributes = const {},
    this.page = 1,
  });

  final String? query;
  final String? category;
  final String? categoryKey;

  /// Resolved by the API *within* [categoryKey], so the two travel together.
  final String? subcategoryKey;
  final String? zone;
  final String sortBy;
  final double? minPrice;
  final double? maxPrice;
  final double? minRating;
  final bool inStock;
  final bool fastDeliveryOnly;

  /// Attribute/variant filters, keyed by attribute key. Sourced from
  /// `GET /api/product-filters` and sent back to `/api/products` as JSON.
  final Map<String, List<String>> attributes;

  final int page;

  /// How many non-default filters are active — drives the filter button's
  /// count badge.
  int get activeFilterCount =>
      (categoryKey != null ? 1 : 0) +
      (subcategoryKey != null ? 1 : 0) +
      (category != null && category != 'All' && categoryKey == null ? 1 : 0) +
      (zone != null && zone != 'All' ? 1 : 0) +
      (minPrice != null ? 1 : 0) +
      (maxPrice != null ? 1 : 0) +
      (minRating != null ? 1 : 0) +
      (inStock ? 1 : 0) +
      (fastDeliveryOnly ? 1 : 0) +
      // Each *group* with a selection counts once, not each value, so picking
      // three sizes reads as one active filter rather than three.
      attributes.values.where((values) => values.isNotEmpty).length;

  ProductSearchQuery copyWith({
    String? query,
    String? category,
    String? categoryKey,
    String? subcategoryKey,
    String? zone,
    String? sortBy,
    double? minPrice,
    double? maxPrice,
    double? minRating,
    bool? inStock,
    bool? fastDeliveryOnly,
    Map<String, List<String>>? attributes,
    int? page,
    bool clearCategory = false,
    bool clearMinPrice = false,
    bool clearMaxPrice = false,
    bool clearMinRating = false,
  }) {
    return ProductSearchQuery(
      query: query ?? this.query,
      category: clearCategory ? null : (category ?? this.category),
      categoryKey: clearCategory ? null : (categoryKey ?? this.categoryKey),
      subcategoryKey:
          clearCategory ? null : (subcategoryKey ?? this.subcategoryKey),
      zone: zone ?? this.zone,
      sortBy: sortBy ?? this.sortBy,
      minPrice: clearMinPrice ? null : (minPrice ?? this.minPrice),
      maxPrice: clearMaxPrice ? null : (maxPrice ?? this.maxPrice),
      minRating: clearMinRating ? null : (minRating ?? this.minRating),
      inStock: inStock ?? this.inStock,
      fastDeliveryOnly: fastDeliveryOnly ?? this.fastDeliveryOnly,
      // Category changes clear these too: an attribute filter from the old
      // category matches nothing in the new one and silently empties the grid.
      attributes: clearCategory ? const {} : (attributes ?? this.attributes),
      page: page ?? this.page,
    );
  }
}

final dealsQueryProvider = StateProvider.autoDispose<ProductSearchQuery>(
  (ref) => const ProductSearchQuery(sortBy: 'popular'),
);

final dealsResultsProvider = FutureProvider.autoDispose<ProductSearchResult>((
  ref,
) {
  final query = ref.watch(dealsQueryProvider);
  return ref
      .watch(productsRepositoryProvider)
      .searchProducts(
        query: query.query,
        category: query.category,
        categoryKey: query.categoryKey,
        subcategoryKey: query.subcategoryKey,
        zone: query.zone,
        attributes: query.attributes,
        sortBy: query.sortBy,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        minRating: query.minRating,
        inStock: query.inStock,
        fastDeliveryOnly: query.fastDeliveryOnly,
        page: query.page,
      );
});

final searchQueryProvider = StateProvider.autoDispose<ProductSearchQuery>(
  (ref) => const ProductSearchQuery(),
);

final searchResultsProvider = FutureProvider.autoDispose<ProductSearchResult>((
  ref,
) {
  final query = ref.watch(searchQueryProvider);
  if ((query.query ?? '').isEmpty && query.activeFilterCount == 0) {
    return const ProductSearchResult(
      products: [],
      total: 0,
      page: 1,
      pages: 1,
      hasMore: false,
    );
  }
  return ref
      .watch(productsRepositoryProvider)
      .searchProducts(
        query: query.query,
        category: query.category,
        categoryKey: query.categoryKey,
        subcategoryKey: query.subcategoryKey,
        zone: query.zone,
        attributes: query.attributes,
        sortBy: query.sortBy,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        minRating: query.minRating,
        inStock: query.inStock,
        fastDeliveryOnly: query.fastDeliveryOnly,
        page: query.page,
      );
});

final productDetailProvider = FutureProvider.autoDispose
    .family<Product, String>((ref, id) {
      return ref.watch(productsRepositoryProvider).fetchProduct(id);
    });

final relatedProductsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, id) {
      return ref.watch(productsRepositoryProvider).fetchRelated(id);
    });

final productReviewsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, productId) {
      return ref
          .watch(productsRepositoryProvider)
          .fetchProductReviews(productId);
    });

final sellerReviewsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, sellerId) {
      return ref.watch(productsRepositoryProvider).fetchSellerReviews(sellerId);
    });

/// A seller's catalog is just `GET /api/products?sellerId=...` — there's
/// no dedicated seller-catalog endpoint (BACKEND_REFERENCE.md §3.3).
final sellerCatalogProvider = FutureProvider.autoDispose
    .family<ProductSearchResult, String>((ref, sellerId) {
      return ref
          .watch(productsRepositoryProvider)
          .searchProducts(sellerId: sellerId, page: 1, limit: 100);
    });

final mostBoughtProvider = FutureProvider.autoDispose<List<Product>>((ref) {
  return ref
      .watch(productsRepositoryProvider)
      .fetchPeopleLikeYou(mode: 'daily');
});

/// No "list all sellers" endpoint exists (BACKEND_REFERENCE.md §3.3/§3.8
/// only expose seller data embedded per-product) — this derives a
/// directory client-side from whatever products the feed has already
/// loaded, deduped by seller id. Necessarily incomplete: a seller with no
/// product in the current feed simply won't appear. Flagged in README.
final sellerDirectoryProvider = FutureProvider.autoDispose<List<ProductSeller>>(
  (ref) async {
    final feed = await ref.watch(productFeedProvider.future);
    final all = [
      ...feed.hotProducts,
      ...feed.forYouProducts,
      ...feed.newListings,
      ...feed.discoverProducts,
    ];
    final bySellerId = <String, ProductSeller>{};
    for (final product in all) {
      final seller = product.seller;
      if (seller != null) bySellerId[seller.id] = seller;
    }
    return bySellerId.values.toList();
  },
);

/// Filter groups for whatever the Search screen is currently showing.
///
/// Watches [searchQueryProvider] so the option counts track the active
/// category and search text — the same behaviour as the web filter rail, where
/// narrowing the category narrows the filters on offer. The selected
/// attributes are deliberately NOT part of the request: including them would
/// make each group re-count against its own selection and options would
/// disappear as soon as they were picked.
final searchFiltersProvider = FutureProvider.autoDispose<ProductFilters>((
  ref,
) {
  final query = ref.watch(searchQueryProvider);
  return ref
      .watch(productsRepositoryProvider)
      .fetchProductFilters(
        categoryKey: query.categoryKey,
        subcategoryKey: query.subcategoryKey,
        query: query.query,
      );
});
