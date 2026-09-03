import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/data/category_tree.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../state/products_providers.dart';

/// Matches the collage's "Hot Deals" grid frame — category filter tabs
/// over a product grid. Full 12-category list mirrored from the web app's
/// `CATEGORY_TREE` (`lib/variants.ts`, no `/api/categories` endpoint
/// exists); `categoryKey` is sent to `GET /api/products` since that's the
/// param the backend actually filters `Product.categoryKey` on.
class DealsScreen extends ConsumerWidget {
  const DealsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(dealsQueryProvider);
    final resultsAsync = ref.watch(dealsResultsProvider);

    return Column(
      children: [
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.sm,
            ),
            itemCount: productCategories.length + 1,
            separatorBuilder: (context, index) =>
                const SizedBox(width: AppSpacing.sm),
            itemBuilder: (context, index) {
              if (index == 0) {
                final isSelected = query.categoryKey == null;
                return ChoiceChip(
                  label: const Text('All'),
                  selected: isSelected,
                  onSelected: (_) =>
                      ref.read(dealsQueryProvider.notifier).state = query
                          .copyWith(page: 1, clearCategory: true),
                );
              }
              final category = productCategories[index - 1];
              final isSelected = query.categoryKey == category.key;
              return ChoiceChip(
                label: Text(category.label),
                selected: isSelected,
                onSelected: (_) => ref.read(dealsQueryProvider.notifier).state =
                    query.copyWith(
                      category: category.label,
                      categoryKey: category.key,
                      page: 1,
                    ),
              );
            },
          ),
        ),
        Expanded(
          child: resultsAsync.when(
            data: (result) {
              if (result.products.isEmpty) {
                return const EmptyState(
                  title: 'No deals here yet',
                  message: 'Try a different category.',
                );
              }
              return RefreshIndicator(
                onRefresh: () => ref.refresh(dealsResultsProvider.future),
                child: GridView.builder(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: AppSpacing.sm,
                    crossAxisSpacing: AppSpacing.sm,
                    mainAxisExtent: 280,
                  ),
                  itemCount: result.products.length,
                  itemBuilder: (context, index) {
                    final product = result.products[index];
                    return ProductCard(
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
                    );
                  },
                ),
              );
            },
            loading: () => GridView.builder(
              padding: const EdgeInsets.all(AppSpacing.lg),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: AppSpacing.sm,
                crossAxisSpacing: AppSpacing.sm,
                mainAxisExtent: 280,
              ),
              itemCount: 6,
              itemBuilder: (context, index) => const ProductCardSkeleton(),
            ),
            error: (error, stackTrace) => ErrorState(
              message: 'Could not load deals.\n$error',
              onRetry: () => ref.invalidate(dealsResultsProvider),
            ),
          ),
        ),
      ],
    );
  }
}
