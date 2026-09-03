import '../../../core/api/api_client.dart';
import 'product_models.dart';

class ProductFeed {
  const ProductFeed({
    required this.hotProducts,
    required this.forYouProducts,
    required this.newListings,
    required this.discoverProducts,
  });

  final List<Product> hotProducts;
  final List<Product> forYouProducts;
  final List<Product> newListings;
  final List<Product> discoverProducts;
}

class ProductSearchResult {
  const ProductSearchResult({
    required this.products,
    required this.total,
    required this.page,
    required this.pages,
    required this.hasMore,
  });

  final List<Product> products;
  final int total;
  final int page;
  final int pages;
  final bool hasMore;
}

/// Wraps the Products & Search domain (BACKEND_REFERENCE.md §3.3). Cart/
/// checkout/orders are out of scope here (Phase 5/6) — this repo is
/// read-only browsing.
class ProductsRepository {
  final _api = ApiClient.instance;

  /// `GET /api/products/feed` — the marketplace home's personalized feed.
  /// Requires `user.universityId` (403 otherwise, per §3.3).
  Future<ProductFeed> fetchFeed() async {
    final response = await _api.get('/api/products/feed');
    List<Product> parse(String key) => (response[key] as List? ?? const [])
        .whereType<Map>()
        .map((p) => Product.fromJson(p.cast<String, dynamic>()))
        .toList();

    return ProductFeed(
      hotProducts: parse('hotProducts'),
      forYouProducts: parse('forYouProducts'),
      newListings: parse('newListings'),
      discoverProducts: parse('discoverProducts'),
    );
  }

  /// `GET /api/products` — list/search/filter, used by Deals grid and
  /// Search. `category`/`categoryKey` casing is unconfirmed against the
  /// live category tree (no `/api/categories` endpoint is documented) —
  /// verify against real data once reachable.
  Future<ProductSearchResult> searchProducts({
    String? query,
    String? category,
    String? categoryKey,
    String? sellerId,
    String? zone,
    String? hostel,
    String? campaignTag,
    String sortBy = 'relevance',
    double? minPrice,
    double? maxPrice,
    double? minRating,
    bool inStock = false,
    bool fastDeliveryOnly = false,
    int page = 1,
    int limit = 40,
  }) async {
    final response = await _api.get(
      '/api/products',
      queryParameters: {
        if (query != null && query.isNotEmpty) 'q': query,
        // `categoryKey` (the real snake_case key, e.g. "fashion") takes
        // precedence — `app/api/products/route.ts` reads `categoryKey` and
        // falls back to `category` treating IT as a key too, so sending the
        // display label as `category` alone silently fails to match.
        if (categoryKey != null && categoryKey.isNotEmpty)
          'categoryKey': categoryKey
        else if (category != null && category.isNotEmpty && category != 'All')
          'category': category,
        'sellerId': ?sellerId,
        if (zone != null && zone.isNotEmpty && zone != 'All') 'zone': zone,
        if (hostel != null && hostel.isNotEmpty && hostel != 'All')
          'hostel': hostel,
        'campaignTag': ?campaignTag,
        'sortBy': sortBy,
        'minPrice': ?minPrice,
        'maxPrice': ?maxPrice,
        'minRating': ?minRating,
        if (inStock) 'inStock': 'true',
        // `delivery=fast` — server parses free-text `deliveryEstimate` for
        // a "fast" heuristic (BACKEND_REFERENCE.md §3.3's product-filters
        // notes / `app/api/products/route.ts`'s `isFastDelivery()`).
        if (fastDeliveryOnly) 'delivery': 'fast',
        'page': page,
        'limit': limit,
      },
    );

    return ProductSearchResult(
      products: (response['products'] as List? ?? const [])
          .whereType<Map>()
          .map((p) => Product.fromJson(p.cast<String, dynamic>()))
          .toList(),
      total: response['total'] as int? ?? 0,
      page: response['page'] as int? ?? 1,
      pages: response['pages'] as int? ?? 1,
      hasMore: response['hasMore'] as bool? ?? false,
    );
  }

  /// `GET /api/products/{id}` — public, no auth required.
  Future<Product> fetchProduct(String id) async {
    final response = await _api.get('/api/products/$id');
    return Product.fromJson(response['product'] as Map<String, dynamic>);
  }

  /// `POST /api/products/{id}/view` — fire-and-forget telemetry; call from
  /// the product-detail screen (never errors to the client per §3.3).
  Future<void> recordView(String productId) {
    return _api.post('/api/products/$productId/view');
  }

  Future<void> reportProduct(String productId, {String? reason}) {
    return _api.post(
      '/api/products/$productId/report',
      data: {if (reason != null && reason.isNotEmpty) 'reason': reason},
    );
  }

  /// `GET /api/products/{id}/related` — "customers also bought/viewed",
  /// "similar products", etc. Returns raw sections since each has its own
  /// title/reason and a slightly different product shape subset.
  Future<List<Map<String, dynamic>>> fetchRelated(String productId) async {
    final response = await _api.get('/api/products/$productId/related');
    return (response['sections'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  /// `GET /api/products/people-like-you` — backs the "Most Bought" screen.
  Future<List<Product>> fetchPeopleLikeYou({
    String mode = 'daily',
    int page = 1,
  }) async {
    final response = await _api.get(
      '/api/products/people-like-you',
      queryParameters: {'mode': mode, 'page': page},
    );
    return (response['items'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (item) => Product.fromJson(
            (item['product'] as Map).cast<String, dynamic>(),
          ),
        )
        .toList();
  }

  Future<List<String>> fetchSearchSuggestions(String query) async {
    final response = await _api.get(
      '/api/search/suggestions',
      queryParameters: {'q': query},
    );
    return (response['suggestions'] as List? ?? const [])
        .whereType<Map>()
        .map((s) => s['text']?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toList();
  }

  /// `GET /api/sellers/{sellerId}/reviews` — bare array response (not
  /// wrapped), SELLER-type only, hardcoded `take: 100` (§3.8). `_api.get`
  /// still normalizes this fine — a non-Map body comes back as
  /// `{'data': [...]}` (see `ApiClient._request`), which also gets proper
  /// `ApiException` handling on error instead of a raw `DioException`.
  Future<List<Map<String, dynamic>>> fetchSellerReviews(String sellerId) async {
    final response = await _api.get('/api/sellers/$sellerId/reviews');
    final data = response['data'];
    if (data is List) return data.cast<Map<String, dynamic>>();
    return const [];
  }

  /// `GET /api/reviews/product` — list + rating distribution for one
  /// product.
  Future<Map<String, dynamic>> fetchProductReviews(
    String productId, {
    int page = 1,
  }) {
    return _api.get(
      '/api/reviews/product',
      queryParameters: {'productId': productId, 'page': page},
    );
  }
}
