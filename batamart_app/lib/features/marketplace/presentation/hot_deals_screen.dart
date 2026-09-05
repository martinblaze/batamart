import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../data/product_models.dart';
import '../state/products_providers.dart';

/// Hot deals — the discount surface, mirroring the web app's
/// `/marketplace/deals` page.
///
/// One thing worth knowing: `GET /api/products` has **no server-side discount
/// filter**. The Deals *tab* simply calls it with `sortBy: popular`, which is
/// why it lists undiscounted items too. This screen requests a wide page and
/// filters on `discountPercent` client-side, then orders by depth of discount
/// — so "hot deals" actually means discounted, biggest saving first.
///
/// That also means the page is a single wide fetch rather than a paginated
/// list: paginating a client-side filter would return uneven, mostly-empty
/// pages. If a discount filter ever lands server-side, this should move to it.
final hotDealsProvider = FutureProvider.autoDispose<List<Product>>((ref) async {
  final result = await ref
      .watch(productsRepositoryProvider)
      .searchProducts(sortBy: 'popular', limit: 100);

  final discounted = result.products.where((p) => p.hasDiscount).toList()
    ..sort((a, b) => (b.discountPercent ?? 0).compareTo(a.discountPercent ?? 0));
  return discounted;
});

class HotDealsScreen extends ConsumerWidget {
  const HotDealsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final dealsAsync = ref.watch(hotDealsProvider);

    return Scaffold(
      backgroundColor: palette.page,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(hotDealsProvider.future),
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          slivers: [
            SliverAppBar(
              expandedHeight: 190,
              pinned: true,
              stretch: true,
              automaticallyImplyLeading: false,
              backgroundColor: palette.page,
              surfaceTintColor: Colors.transparent,
              leading: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Pressable(
                  scale: 0.9,
                  onTap: () => Navigator.of(context).maybePop(),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.38),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      LucideIcons.arrowLeft,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                ),
              ),
              flexibleSpace: FlexibleSpaceBar(
                stretchModes: const [StretchMode.zoomBackground],
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    KenBurns(
                      child: Image.asset(
                        'assets/images/banner-market.webp',
                        fit: BoxFit.cover,
                      ),
                    ),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0x59000000), Color(0xF2000000)],
                          stops: [0, 0.9],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Row(
                            children: [
                              const Icon(LucideIcons.zap, size: 13, color: Colors.white70),
                              const SizedBox(width: 6),
                              Text(
                                'LIVE DISCOUNTS',
                                style: AppTypography.label(size: 9, color: Colors.white70),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          RichText(
                            text: TextSpan(
                              children: [
                                TextSpan(
                                  text: 'Hot',
                                  style: AppTypography.display(size: 30, color: Colors.white),
                                ),
                                TextSpan(
                                  text: ' deals.',
                                  style: AppTypography.serif(size: 30, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                          dealsAsync.maybeWhen(
                            data: (deals) => Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                deals.isEmpty
                                    ? 'Nothing discounted right now'
                                    : '${deals.length} items discounted, biggest saving first',
                                style: const TextStyle(fontSize: 12, color: Colors.white70),
                              ),
                            ),
                            orElse: () => const SizedBox.shrink(),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            dealsAsync.when(
              data: (deals) {
                if (deals.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: EmptyState(
                      icon: LucideIcons.tag,
                      title: 'No deals right now',
                      message:
                          'Nothing on campus is discounted at the moment. Check back later.',
                      actionLabel: 'Browse everything',
                      onActionTap: () => context.push(AppRoutes.search),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.md,
                    AppSpacing.xxl,
                  ),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: AppSpacing.lg,
                      crossAxisSpacing: AppSpacing.sm,
                      mainAxisExtent: 288,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final product = deals[index];
                        return ProductCard(
                          imageUrl: product.thumbnail,
                          name: product.name,
                          price: naira(product.price),
                          percentOff: product.discountPercent,
                          rating: product.avgRating > 0 ? product.avgRating : null,
                          reviewCount: product.totalReviews,
                          location: product.landmark,
                          onTap: () => context.push(
                            AppRoutes.productDetailPath(product.id),
                          ),
                        ).enter(index: index);
                      },
                      childCount: deals.length,
                    ),
                  ),
                );
              },
              loading: () => SliverPadding(
                padding: const EdgeInsets.all(AppSpacing.md),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: AppSpacing.lg,
                    crossAxisSpacing: AppSpacing.sm,
                    mainAxisExtent: 288,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => const ProductCardSkeleton(),
                    childCount: 6,
                  ),
                ),
              ),
              error: (error, stackTrace) => SliverFillRemaining(
                hasScrollBody: false,
                child: ErrorState(
                  message: 'Could not load deals.\n$error',
                  onRetry: () => ref.invalidate(hotDealsProvider),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Flash picks — a small rotating selection of the day's deepest discounts.
///
/// The rotation is seeded by the date, so the selection is stable for a whole
/// day and changes tomorrow. No countdown timer: the design bible bans
/// manufactured urgency, and a ticking clock on a student marketplace would be
/// a lie anyway, since nothing actually expires at midnight.
class FlashPicks extends ConsumerWidget {
  const FlashPicks({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final dealsAsync = ref.watch(hotDealsProvider);

    return dealsAsync.maybeWhen(
      data: (deals) {
        if (deals.length < 3) return const SizedBox.shrink();

        // Seeded by the day so everyone sees a consistent set that refreshes
        // once every 24 hours.
        final now = DateTime.now();
        final seed = now.year * 10000 + now.month * 100 + now.day;
        final pool = [...deals];
        var s = seed;
        for (var i = pool.length - 1; i > 0; i--) {
          s = (s * 1664525 + 1013904223) & 0x7fffffff;
          final j = s % (i + 1);
          final tmp = pool[i];
          pool[i] = pool[j];
          pool[j] = tmp;
        }
        final picks = pool.take(6).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(LucideIcons.zap, size: 13, color: AppColors.warning),
                const SizedBox(width: 6),
                Text(
                  'FLASH PICKS TODAY',
                  style: AppTypography.label(size: 10, color: palette.inkMuted),
                ),
              ],
            ),
            const SizedBox(height: 6),
            RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: "Today's",
                    style: AppTypography.display(size: 21, color: palette.ink),
                  ),
                  TextSpan(
                    text: ' best savings.',
                    style: AppTypography.serif(size: 21, color: palette.ink),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              height: 300,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsets.zero,
                itemCount: picks.length,
                separatorBuilder: (context, index) => const SizedBox(width: AppSpacing.lg),
                itemBuilder: (context, index) {
                  final product = picks[index];
                  return SizedBox(
                    width: 150,
                    child: ProductCard(
                      imageUrl: product.thumbnail,
                      name: product.name,
                      price: naira(product.price),
                      percentOff: product.discountPercent,
                      rating: product.avgRating > 0 ? product.avgRating : null,
                      reviewCount: product.totalReviews,
                      location: product.landmark,
                      onTap: () => context.push(
                        AppRoutes.productDetailPath(product.id),
                      ),
                    ),
                  ).enterX(index: index);
                },
              ),
            ),
          ],
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}
