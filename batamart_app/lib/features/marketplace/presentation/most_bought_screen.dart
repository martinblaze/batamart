import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../state/products_providers.dart';
import '../../../core/utils/money.dart';

/// `GET /api/products/people-like-you?mode=daily` (BACKEND_REFERENCE.md
/// §3.3). The web groups results by `dateKey` with infinite scroll; this
/// is a flat single-page grid for now (no mockup provided for this screen
/// — see README "Phase 4 status") — day-grouping/pagination can be added
/// without changing the repository call shape.
class MostBoughtScreen extends ConsumerWidget {
  const MostBoughtScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(mostBoughtProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Most Bought', showBack: true),
      body: productsAsync.when(
        data: (products) {
          if (products.isEmpty) {
            return const EmptyState(
              title: 'Nothing trending yet',
              message: 'Check back once more orders come in today.',
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(mostBoughtProvider.future),
            child: GridView.builder(
              padding: const EdgeInsets.all(AppSpacing.lg),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: AppSpacing.sm,
                crossAxisSpacing: AppSpacing.sm,
                mainAxisExtent: 280,
              ),
              itemCount: products.length,
              itemBuilder: (context, index) {
                final product = products[index];
                return ProductCard(
                  imageUrl: product.thumbnail,
                  name: product.name,
                  price: naira(product.price),
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
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load most-bought products.\n$error',
          onRetry: () => ref.invalidate(mostBoughtProvider),
        ),
      ),
    );
  }
}
