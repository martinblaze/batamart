import '../../../core/api/api_client.dart';

/// Person reviews (seller/rider) and product reviews are always two
/// separate submissions to two different endpoints — never combined
/// server-side (BACKEND_REFERENCE.md §3.8).
class ReviewsRepository {
  final _api = ApiClient.instance;

  Future<void> submitSellerReview({
    required String orderId,
    required int rating,
    String? comment,
  }) {
    return _api.post(
      '/api/reviews',
      data: {
        'orderId': orderId,
        'type': 'SELLER',
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
  }

  Future<void> submitProductReview({
    required String orderId,
    required int rating,
    String? comment,
  }) {
    return _api.post(
      '/api/reviews/product',
      data: {
        'orderId': orderId,
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
  }
}
