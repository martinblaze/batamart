import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/campaign_badge.dart';
import '../../../core/widgets/badges/trust_badge.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/product_models.dart';
import '../state/products_providers.dart';

/// WEB_PAGES_REFERENCE.md describes this page as showing "rating, bio,
/// join date, product grid, reviews" — but no documented endpoint exposes
/// a seller's bio or join date (BACKEND_REFERENCE.md only embeds
/// `id, name, avgRating, trustLevel, completedOrders[, profilePhoto,
/// hostelName, roomNumber]` per-product, no dedicated seller-profile
/// route). Bio/join-date are omitted here rather than invented; flagged in
/// README "Phase 4 status".
class SellerProfileScreen extends ConsumerWidget {
  const SellerProfileScreen({super.key, required this.sellerId, this.seller});

  final String sellerId;

  /// Fast path: passed via `extra` when navigated from a screen that
  /// already has the full seller sub-object (product detail, directory).
  final ProductSeller? seller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resolvedSeller = seller ?? _findInDirectory(ref);

    return Scaffold(
      appBar: BataAppBar(
        title: resolvedSeller?.name ?? 'Seller',
        showBack: true,
      ),
      body: resolvedSeller == null
          ? const ErrorState(
              title: 'Seller not found',
              message: 'No seller data is available for this profile yet.',
            )
          : _SellerProfileBody(seller: resolvedSeller),
    );
  }

  ProductSeller? _findInDirectory(WidgetRef ref) {
    final directory =
        ref.watch(sellerDirectoryProvider).asData?.value ?? const [];
    for (final s in directory) {
      if (s.id == sellerId) return s;
    }
    return null;
  }
}

class _SellerProfileBody extends ConsumerWidget {
  const _SellerProfileBody({required this.seller});

  final ProductSeller seller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(sellerReviewsProvider(seller.id));

    return RefreshIndicator(
      onRefresh: () => ref.refresh(sellerReviewsProvider(seller.id).future),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundImage: seller.profilePhoto != null
                    ? CachedNetworkImageProvider(seller.profilePhoto!)
                    : null,
                child: seller.profilePhoto == null
                    ? const Icon(Icons.storefront, size: 28)
                    : null,
              ),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      seller.name,
                      style: AppTypography.display(size: 18, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    TrustBadge(level: seller.trustLevel),
                    const SizedBox(height: 4),
                    RatingStars(rating: seller.avgRating),
                    Text(
                      '${seller.completedOrders} completed orders',
                      style: TextStyle(
                        color: context.palette.inkSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            label: 'View All Products',
            onPressed: () =>
                context.push(AppRoutes.sellerCatalogPath(seller.id)),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            'Reviews',
            style: AppTypography.display(size: 16, weight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.sm),
          reviewsAsync.when(
            data: (reviews) {
              if (reviews.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                  child: EmptyState(title: 'No reviews yet'),
                );
              }
              return Column(
                children: [
                  for (final review in reviews.take(20))
                    _SellerReviewTile(review: review),
                ],
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stackTrace) =>
                Text('Could not load reviews.\n$error'),
          ),
        ],
      ),
    );
  }
}

class _SellerReviewTile extends StatelessWidget {
  const _SellerReviewTile({required this.review});

  final Map<String, dynamic> review;

  @override
  Widget build(BuildContext context) {
    final rating = (review['rating'] as num?)?.toInt() ?? 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                review['user']?.toString() ?? 'Anonymous',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Row(
                children: List.generate(
                  5,
                  (i) => Icon(
                    Icons.star_rounded,
                    size: 12,
                    color: i < rating ? AppColors.star : context.palette.hairline,
                  ),
                ),
              ),
            ],
          ),
          if ((review['comment'] as String?)?.isNotEmpty == true)
            Text(review['comment'].toString()),
        ],
      ),
    );
  }
}
