import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../state/products_providers.dart';

/// `GET /api/reviews/product` — rating distribution + full list
/// (BACKEND_REFERENCE.md §3.8). Public endpoint, so reachable by guests
/// (per `_guestBrowsableRoutes` in app_router.dart). Not the same as
/// WEB_PAGES_REFERENCE.md's noted unstyled reviews stub routes — this
/// screen is built against the real, styled review data.
class ProductReviewsScreen extends ConsumerWidget {
  const ProductReviewsScreen({super.key, required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(productReviewsProvider(productId));

    return Scaffold(
      appBar: const BataAppBar(title: 'Reviews', showBack: true),
      body: reviewsAsync.when(
        data: (data) {
          final reviews = (data['reviews'] as List? ?? const [])
              .whereType<Map>()
              .map((r) => r.cast<String, dynamic>())
              .toList();
          final distribution = (data['distribution'] as List? ?? const [])
              .whereType<Map>()
              .map((d) => d.cast<String, dynamic>())
              .toList();

          if (reviews.isEmpty) {
            return const EmptyState(
              title: 'No reviews yet',
              message:
                  'Be the first to review this product after your order is delivered.',
            );
          }

          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(productReviewsProvider(productId).future),
            child: ListView.builder(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: reviews.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                    child: _DistributionChart(distribution: distribution),
                  );
                }
                return _ReviewTile(review: reviews[index - 1]);
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load reviews.\n$error',
          onRetry: () => ref.invalidate(productReviewsProvider(productId)),
        ),
      ),
    );
  }
}

class _DistributionChart extends StatelessWidget {
  const _DistributionChart({required this.distribution});

  final List<Map<String, dynamic>> distribution;

  @override
  Widget build(BuildContext context) {
    final maxCount = distribution.fold<int>(
      1,
      (max, d) =>
          (d['count'] as int? ?? 0) > max ? (d['count'] as int? ?? 0) : max,
    );

    return Column(
      children: [
        for (final entry in distribution.reversed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: [
                Text(
                  '${entry['rating']}★',
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (entry['count'] as int? ?? 0) / maxCount,
                      minHeight: 8,
                      backgroundColor: context.palette.hairline,
                      valueColor: const AlwaysStoppedAnimation(AppColors.star),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text('${entry['count']}', style: const TextStyle(fontSize: 12)),
              ],
            ),
          ),
      ],
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.review});

  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context) {
    final reviewer =
        (review['reviewer'] as Map?)?.cast<String, dynamic>() ?? const {};
    final rating = (review['rating'] as num?)?.toInt() ?? 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundImage: reviewer['profilePhoto'] != null
                    ? CachedNetworkImageProvider(
                        reviewer['profilePhoto'].toString(),
                      )
                    : null,
                child: reviewer['profilePhoto'] == null
                    ? const Icon(Icons.person, size: 16)
                    : null,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                reviewer['name']?.toString() ?? 'Anonymous',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Row(
                children: List.generate(
                  5,
                  (i) => Icon(
                    Icons.star_rounded,
                    size: 14,
                    color: i < rating ? AppColors.star : context.palette.hairline,
                  ),
                ),
              ),
            ],
          ),
          if ((review['comment'] as String?)?.isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(review['comment'].toString()),
          ],
        ],
      ),
    );
  }
}
