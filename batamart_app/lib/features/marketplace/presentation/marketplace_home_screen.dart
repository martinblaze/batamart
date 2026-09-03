import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/data/category_tree.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../data/product_models.dart';
import '../state/products_providers.dart';

/// A representative subset of the full 12-category tree for the compact
/// home-page icon row (matches the mockup's 5-icon layout) — the full list
/// lives on Deals/Search. Keys must exist in [productCategories].
const _homeCategoryKeys = [
  'fashion',
  'electronics',
  'beauty',
  'groceries',
  'home_kitchen',
];

/// Matches the collage's "Marketplace home" frame: search bar, campaign
/// banner, "Hot Deals" row, "Just Dropped" row. Backed by
/// `GET /api/products/feed` (BACKEND_REFERENCE.md §3.3) — requires login +
/// `universityId`, so unlike the web this can't be shown to a guest (see
/// README "Phase 4 status").
class MarketplaceHomeScreen extends ConsumerWidget {
  const MarketplaceHomeScreen({this.onCategorySelected, super.key});

  /// Called with a tapped category so the parent shell (which owns the
  /// bottom-nav tab state) can switch to the Deals tab with that category
  /// pre-applied. If null (e.g. this screen is ever used standalone),
  /// falls back to pushing Search with the category set instead.
  final ValueChanged<ProductCategory>? onCategorySelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(productFeedProvider);

    return RefreshIndicator(
      onRefresh: () => ref.refresh(productFeedProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          _SearchBar(onTap: () => context.push(AppRoutes.search)),
          const SizedBox(height: AppSpacing.lg),
          _CategoryChipsRow(
            onCategoryTap: (category) {
              final onCategorySelected = this.onCategorySelected;
              if (onCategorySelected != null) {
                onCategorySelected(category);
                return;
              }
              ref.read(searchQueryProvider.notifier).state = ref
                  .read(searchQueryProvider)
                  .copyWith(category: category.label, categoryKey: category.key);
              context.push(AppRoutes.search);
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          const _CampaignBanner(),
          const SizedBox(height: AppSpacing.lg),
          const _TrustStrip(),
          const SizedBox(height: AppSpacing.xl),
          feedAsync.when(
            data: (feed) => Column(
              children: [
                _ProductRow(
                  title: 'Hot Deals 🔥',
                  products: feed.hotProducts,
                  onSeeAll: () => context.push(AppRoutes.mostBought),
                ),
                const SizedBox(height: AppSpacing.xl),
                if (feed.forYouProducts.isNotEmpty) ...[
                  _ProductRow(
                    title: 'Picked For You',
                    products: feed.forYouProducts,
                    onSeeAll: () => context.push(AppRoutes.mostBought),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                ],
                _ProductRow(
                  title: 'Just Dropped',
                  products: feed.newListings,
                  onSeeAll: () => context.push(AppRoutes.mostBought),
                ),
                const SizedBox(height: AppSpacing.xl),
                const _PeopleLikeYouRow(),
              ],
            ),
            loading: () => const _FeedLoadingSkeleton(),
            error: (error, stackTrace) => ErrorState(
              message: 'Could not load the marketplace feed.\n$error',
              onRetry: () => ref.invalidate(productFeedProvider),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryChipsRow extends StatelessWidget {
  const _CategoryChipsRow({required this.onCategoryTap});

  final ValueChanged<ProductCategory> onCategoryTap;

  static final _categories = _homeCategoryKeys
      .map((key) => productCategories.firstWhere((c) => c.key == key))
      .toList();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        separatorBuilder: (context, index) =>
            const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) {
          final category = _categories[index];
          return InkWell(
            borderRadius: BorderRadius.circular(AppRadii.md),
            onTap: () => onCategoryTap(category),
            child: SizedBox(
              width: 64,
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    child: Icon(category.icon, color: AppColors.primary),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    category.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Lightweight trust/reassurance strip — cheap scroll-depth content backed
/// by real product-of-the-domain concepts (escrow/delivery/reviews are all
/// real platform features), not fabricated stats.
class _TrustStrip extends StatelessWidget {
  const _TrustStrip();

  static const _points = [
    (LucideIcons.shieldCheck, 'Escrow Protected'),
    (LucideIcons.bike, 'Campus Delivery'),
    (LucideIcons.star, 'Rated Sellers'),
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final point in _points)
          Expanded(
            child: Column(
              children: [
                Icon(point.$1, color: AppColors.primary, size: 22),
                const SizedBox(height: 4),
                Text(
                  point.$2,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// "People Like You Bought" — `GET /api/products/people-like-you`, the
/// same endpoint the Most Bought screen uses (BACKEND_REFERENCE.md §3.3).
class _PeopleLikeYouRow extends ConsumerWidget {
  const _PeopleLikeYouRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peopleLikeYouAsync = ref.watch(mostBoughtProvider);

    return peopleLikeYouAsync.when(
      data: (products) => _ProductRow(
        title: 'People Like You Bought',
        products: products,
        onSeeAll: () => context.push(AppRoutes.mostBought),
      ),
      loading: () => const SizedBox.shrink(),
      error: (error, stackTrace) => const SizedBox.shrink(),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.md),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          children: [
            Icon(Icons.search, color: AppColors.textSecondary),
            SizedBox(width: AppSpacing.sm),
            Text(
              'Search products, sellers...',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

/// Placeholder "Girlfriend's Day"-style campaign banner — the user's real
/// banner image/copy is coming separately; this is a design-system-styled
/// stand-in built with [AppColors.campaignPink] so the marketplace home
/// isn't missing the slot in the meantime.
class _CampaignBanner extends StatelessWidget {
  const _CampaignBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.campaignPink,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CAMPAIGN SPECIAL',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Up to 30% Off!',
                  style: TextStyle(color: Colors.white, fontSize: 13),
                ),
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: const Text(
                    'Shop Now',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.card_giftcard, color: Colors.white, size: 48),
        ],
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow({
    required this.title,
    required this.products,
    required this.onSeeAll,
  });

  final String title;
  final List<Product> products;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            TextButton(onPressed: onSeeAll, child: const Text('See all')),
          ],
        ),
        SizedBox(
          height: 260,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: products.length,
            separatorBuilder: (context, index) =>
                const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, index) {
              final product = products[index];
              return SizedBox(
                width: 150,
                child: ProductCard(
                  imageUrl: product.thumbnail,
                  name: product.name,
                  price: '₦${product.price.toStringAsFixed(0)}',
                  percentOff: product.hasDiscount
                      ? product.discountPercent
                      : null,
                  rating: product.avgRating > 0 ? product.avgRating : null,
                  reviewCount: product.totalReviews,
                  location: product.landmark,
                  onTap: () =>
                      context.push(AppRoutes.productDetailPath(product.id)),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _FeedLoadingSkeleton extends StatelessWidget {
  const _FeedLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: AppSpacing.sm,
      crossAxisSpacing: AppSpacing.sm,
      mainAxisExtent: 280,
      children: List.generate(4, (_) => const ProductCardSkeleton()),
    );
  }
}
