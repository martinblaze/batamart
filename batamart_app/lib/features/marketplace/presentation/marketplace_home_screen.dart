import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/data/category_images.dart';
import '../../../core/data/category_tree.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../data/product_models.dart';
import '../state/recently_viewed.dart';
import '../state/products_providers.dart';
import 'widgets/home_sections.dart';
import 'hot_deals_screen.dart';
import '../../../core/utils/money.dart';

/// A representative subset of the full 12-category tree for the compact
/// home-page icon row (matches the mockup's 5-icon layout) — the full list
/// lives on Deals/Search. Keys must exist in [productCategories].
const _homeCategoryKeys = [
  'fashion',
  'electronics',
  'groceries',
  'beauty',
  'computing',
  'home_kitchen',
  'sports',
  'books',
  'kids',
  'vehicles',
  'tickets',
  'arts_crafts',
];

/// Matches the collage's "Marketplace home" frame: search bar, campaign
/// banner, "Hot Deals" row, "Just Dropped" row. Backed by
/// `GET /api/products/feed` (BACKEND_REFERENCE.md §3.3) — requires login +
/// `universityId`, so unlike the web this can't be shown to a guest (see
/// README "Phase 4 status").
class MarketplaceHomeScreen extends ConsumerWidget {
  const MarketplaceHomeScreen({
    this.onCategorySelected,
    this.onSeeAllDeals,
    super.key,
  });

  /// Switches the shell to the Deals tab. Hot deals' "see all" belongs there
  /// rather than on a pushed lookalike list.
  final VoidCallback? onSeeAllDeals;

  /// Called with a tapped category so the parent shell (which owns the
  /// bottom-nav tab state) can switch to the Deals tab with that category
  /// pre-applied. If null (e.g. this screen is ever used standalone),
  /// falls back to pushing Search with the category set instead.
  final ValueChanged<ProductCategory>? onCategorySelected;

  /// Opens Search pre-sorted. Each feed row now leads somewhere that actually
  /// reflects the row — previously all four pointed at /most-bought.
  void _openSearch(WidgetRef ref, BuildContext context, {required String sortBy}) {
    ref.read(searchQueryProvider.notifier).state =
        ProductSearchQuery(sortBy: sortBy);
    context.push(AppRoutes.search);
  }

  /// Sets the Deals filter and switches to that tab. Everything on this feed
  /// that narrows the catalogue lands here, so a tap always ends on a screen
  /// showing filtered results rather than an empty search box.
  void _openDeals(
    WidgetRef ref,
    BuildContext context, {
    double? maxPrice,
    ProductCategory? category,
    String sortBy = 'popular',
  }) {
    // A subcategory only filters when its parent travels with it — the API
    // resolves subcategoryKey *within* categoryKey. Sending a subcategory key
    // on its own as categoryKey matches nothing, and left the Deals rail with
    // no row highlighted and no way back up the tree.
    final key = category?.key;
    final parent = key == null ? null : parentCategoryOf(key);
    final isSub = parent != null;

    ref.read(dealsQueryProvider.notifier).state = ProductSearchQuery(
      sortBy: sortBy,
      maxPrice: maxPrice,
      category: isSub
          ? findCategory(parent)?.label
          : category?.label,
      categoryKey: isSub ? parent : key,
      subcategoryKey: isSub ? key : null,
    );
    final switchTab = onSeeAllDeals;
    if (switchTab != null) {
      switchTab();
    } else {
      context.push(AppRoutes.search);
    }
  }

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

          // What the platform actually promises, before any merchandising.
          const PromiseCarousel().enter(),
          const SizedBox(height: AppSpacing.section),

          const FeedSection(
            eyebrow: 'Shop by category',
            title: 'Find it',
            accent: 'faster.',
          ),
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
          const SizedBox(height: AppSpacing.section),
          BudgetBands(
            onPick: (maxPrice, category) => _openDeals(
              ref,
              context,
              maxPrice: maxPrice,
              category: category,
              sortBy: 'price_asc',
            ),
          ),
          const SizedBox(height: AppSpacing.section),
          const _CampaignBanner().enter(),
          const SizedBox(height: AppSpacing.section),
          const FlashPicks(),
          const SizedBox(height: AppSpacing.section),
          const _TrustStrip(),
          const SizedBox(height: AppSpacing.section),
          feedAsync.when(
            data: (feed) => Column(
              children: [
                _ProductRow(
                  eyebrow: 'Discounted now',
                  title: 'Hot',
                  accent: 'deals.',
                  products: feed.hotProducts,
                  // Pushes the dedicated Hot Deals page — the Deals tab is a
                  // browsable catalogue, this is the discount surface proper.
                  onSeeAll: () => context.push(AppRoutes.hotDeals),
                ),
                const SizedBox(height: AppSpacing.xl),
                if (feed.forYouProducts.isNotEmpty) ...[
                  _ProductRow(
                    eyebrow: 'Based on what you view',
                    title: 'Picked for',
                    accent: 'you.',
                    products: feed.forYouProducts,
                    // No see-all: this row is a personalised selection, not the
                    // head of a longer list there is an endpoint for.
                    onSeeAll: null,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                ],
                _ProductRow(
                  eyebrow: 'New on campus',
                  title: 'Just',
                  accent: 'dropped.',
                  products: feed.newListings,
                  onSeeAll: () => _openSearch(ref, context, sortBy: 'newest'),
                ),
                const SizedBox(height: AppSpacing.xl),
                const _PeopleLikeYouRow(),
                const SizedBox(height: AppSpacing.section),
                const _RecentlyViewedRow(),

                // Image-led category panels. Each subcategory chip filters
                // Deals directly rather than dumping the user on Search.
                for (final key in const [
                  'electronics',
                  'fashion',
                  'beauty',
                  'home_kitchen',
                ]) ...[
                  CategorySpotlight(
                    categoryKey: key,
                    onCategory: (category) =>
                        _openDeals(ref, context, category: category),
                    onSubcategory: (sub) =>
                        _openDeals(ref, context, category: sub),
                  ).enter(),
                  const SizedBox(height: AppSpacing.section),
                ],

                SellCta(
                  onTap: () => context.push(AppRoutes.sellProduct),
                ).enter(),
                const SizedBox(height: AppSpacing.xl),
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
    // Two rows of tiles that scroll sideways as a block. A photograph per
    // category, its name set over a scrim at the foot.
    return SizedBox(
      height: 232,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.zero,
        itemCount: (_categories.length / 2).ceil(),
        itemBuilder: (context, column) {
          final first = _categories[column * 2];
          final secondIndex = column * 2 + 1;
          final second =
              secondIndex < _categories.length ? _categories[secondIndex] : null;
          return Padding(
            padding: const EdgeInsets.only(right: AppSpacing.md),
            child: Column(
              children: [
                _CategoryTile(category: first, onTap: () => onCategoryTap(first))
                    .enterX(index: column),
                const SizedBox(height: AppSpacing.md),
                if (second != null)
                  _CategoryTile(
                    category: second,
                    onTap: () => onCategoryTap(second),
                  ).enterX(index: column),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// One category, told by its photograph.
class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.onTap});

  final ProductCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final image = categoryImage(category.key);
    final palette = context.palette;

    return Pressable(
      onTap: onTap,
      scale: 0.96,
      child: SizedBox(
        width: 132,
        height: 108,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (image != null)
                Image.asset(image, fit: BoxFit.cover)
              else
                Container(
                  color: palette.card,
                  alignment: Alignment.center,
                  child: Icon(category.icon, color: palette.inkMuted),
                ),
              // Foot-weighted scrim: enough to hold the label, light enough
              // that the photograph still reads.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x00000000), Color(0x1A000000), Color(0xD9000000)],
                    stops: [0, 0.45, 1],
                  ),
                ),
              ),
              Positioned(
                left: AppSpacing.sm + 2,
                right: AppSpacing.sm,
                bottom: AppSpacing.sm + 1,
                child: Text(
                  category.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.display(
                    size: 13,
                    color: Colors.white,
                    weight: FontWeight.w600,
                    height: 1.15,
                  ),
                ),
              ),
            ],
          ),
        ),
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
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: palette.hairline),
          bottom: BorderSide(color: palette.hairline),
        ),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _points.length; i++) ...[
            if (i > 0)
              Container(width: 1, height: 22, color: palette.hairline),
            Expanded(
              child: Column(
                children: [
                  Icon(_points[i].$1, color: palette.inkMuted, size: 16),
                  const SizedBox(height: 6),
                  Text(
                    _points[i].$2.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: AppTypography.label(size: 9, color: palette.inkSecondary),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
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
        eyebrow: 'Most bought today',
        title: 'What others',
        accent: 'are buying.',
        products: products,
        // This row *is* the most-bought list, so /most-bought is the correct
        // destination for it — and only for it.
        onSeeAll: () => context.push(AppRoutes.mostBought),
      ),
      loading: () => const SizedBox.shrink(),
      error: (error, stackTrace) => const SizedBox.shrink(),
    );
  }
}

/// Products opened on this device, newest first. Hidden until there is one.
class _RecentlyViewedRow extends ConsumerWidget {
  const _RecentlyViewedRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(recentlyViewedProvider);
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FeedSection(
          eyebrow: 'Pick up where you left off',
          title: 'Recently',
          accent: 'viewed.',
        ),
        SizedBox(
          height: 320,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (context, index) => const SizedBox(width: AppSpacing.lg),
            itemBuilder: (context, index) {
              final item = items[index];
              return SizedBox(
                width: 150,
                child: ProductCard(
                  imageUrl: item.image,
                  name: item.name,
                  price: naira(item.price),
                  location: item.landmark,
                  onTap: () => context.push(AppRoutes.productDetailPath(item.id)),
                ),
              );
            },
          ),
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => ref.read(recentlyViewedProvider.notifier).clear(),
            child: const Text('Clear history'),
          ),
        ),
        const SizedBox(height: AppSpacing.section),
      ],
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
          color: context.palette.page,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: context.palette.hairline),
        ),
        child: Row(
          children: [
            Icon(Icons.search, color: context.palette.inkSecondary),
            SizedBox(width: AppSpacing.sm),
            Text(
              'Search products, sellers...',
              style: TextStyle(color: context.palette.inkSecondary),
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
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: SizedBox(
        height: 148,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // The photograph drifts continuously behind the copy. Campaign
            // rose survives as the scrim tint, so the slot is still
            // unmistakably the campaign without being a flat block of colour.
            KenBurns(
              child: Image.asset(
                'assets/images/banner-market.webp',
                fit: BoxFit.cover,
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    AppColors.campaignRose.withValues(alpha: 0.95),
                    AppColors.campaignRose.withValues(alpha: 0.55),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'CAMPAIGN SPECIAL',
                    style: AppTypography.label(
                      size: 10,
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: 'Up to 30%',
                          style: AppTypography.display(size: 27, color: Colors.white),
                        ),
                        TextSpan(
                          text: ' off.',
                          style: AppTypography.serif(size: 27, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Text(
                      'SHOP NOW',
                      style: AppTypography.label(size: 10, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow({
    required this.eyebrow,
    required this.title,
    required this.products,
    required this.onSeeAll,
    this.accent,
  });

  final String eyebrow;
  final String? accent;
  final String title;
  final List<Product> products;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FeedSection(
          eyebrow: eyebrow,
          title: title,
          accent: accent,
          onSeeAll: onSeeAll,
        ),
        SizedBox(
          // 4:5 art on a 150pt tile is 187pt, plus room for the metadata
          // block underneath without clipping the second title line.
          height: 320,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: products.length,
            separatorBuilder: (context, index) =>
                const SizedBox(width: AppSpacing.lg),
            itemBuilder: (context, index) {
              final product = products[index];
              return SizedBox(
                width: 150,
                child: ProductCard(
                  imageUrl: product.thumbnail,
                  name: product.name,
                  price: naira(product.price),
                  isHot: product.isHot,
                  percentOff: product.hasDiscount
                      ? product.discountPercent
                      : null,
                  rating: product.avgRating > 0 ? product.avgRating : null,
                  reviewCount: product.totalReviews,
                  location: product.landmark,
                  onTap: () =>
                      context.push(AppRoutes.productDetailPath(product.id)),
                ),
              ).enterX(index: index);
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
