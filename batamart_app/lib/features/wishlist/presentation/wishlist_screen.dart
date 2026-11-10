import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../state/wishlist_providers.dart';
import 'wishlist_heart.dart';

/// Saved products, with price-dropped and out-of-stock flags.
class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(wishlistItemsProvider);
    // Keeps hearts in step when something is removed from this screen.
    ref.watch(wishlistIdsProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Wishlist', showBack: true),
      body: async.when(
        loading: () => GridView.builder(
          padding: const EdgeInsets.all(AppSpacing.md),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacing.lg,
            crossAxisSpacing: AppSpacing.sm,
            mainAxisExtent: 288,
          ),
          itemCount: 6,
          itemBuilder: (context, index) => const ProductCardSkeleton(),
        ),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load your wishlist.',
          onRetry: () => ref.invalidate(wishlistItemsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              icon: LucideIcons.heart,
              title: 'Nothing saved yet',
              message: 'Tap the heart on any product to keep it here.',
              actionLabel: 'Start browsing',
              onActionTap: () => context.go(AppRoutes.home),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(wishlistItemsProvider.future),
            child: GridView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.xxl,
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: AppSpacing.lg,
                crossAxisSpacing: AppSpacing.sm,
                mainAxisExtent: 300,
              ),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final dropped = item.priceDropped && !item.unavailable;
                final was = item.priceWhenSaved;
                return ProductCard(
                  imageUrl: item.image,
                  name: item.name,
                  price: naira(item.price),
                  originalPrice: dropped && was != null && was > item.price
                      ? naira(was)
                      : (item.originalPrice != null &&
                                item.originalPrice! > item.price
                            ? naira(item.originalPrice!)
                            : null),
                  percentOff: dropped
                      ? (item.dropPercent ?? item.discountPercent)
                      : item.discountPercent,
                  category: item.category,
                  soldOut: item.unavailable,
                  flag: dropped ? 'Price dropped' : null,
                  favorite: WishlistHeart(productId: item.productId),
                  onTap: () =>
                      context.push(AppRoutes.productDetailPath(item.productId)),
                ).enter(index: index);
              },
            ),
          );
        },
      ),
    );
  }
}
