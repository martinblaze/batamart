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

/// A seller's full catalog — `GET /api/products?sellerId=...`
/// (BACKEND_REFERENCE.md §3.3). No dedicated seller-catalog endpoint
/// exists; this reuses the same list/search route scoped to one seller.
class SellerCatalogScreen extends ConsumerWidget {
  const SellerCatalogScreen({super.key, required this.sellerId});

  final String sellerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultAsync = ref.watch(sellerCatalogProvider(sellerId));

    return Scaffold(
      appBar: const BataAppBar(title: 'Seller Catalog', showBack: true),
      body: resultAsync.when(
        data: (result) {
          if (result.products.isEmpty) {
            // TEMPORARY DIAGNOSTIC — remove once the empty-catalog bug is
            // understood. The backend query was verified correct against the
            // live database (33 sellers, right counts), and every client path
            // resolves a real seller id, so the remaining unknown is what this
            // device actually sends and receives. Logs are not reachable on a
            // sideloaded release build, so it is surfaced on screen.
            return EmptyState(
              title: 'No products yet',
              message:
                  'This seller has no active listings right now.'
                  '\n\ndebug — sellerId: "$sellerId"'
                  '\ntotal: ${result.total} · page: ${result.page}'
                  ' · pages: ${result.pages}',
            );
          }
          return RefreshIndicator(
            onRefresh: () =>
                ref.refresh(sellerCatalogProvider(sellerId).future),
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
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load this seller\'s catalog.\n$error',
          onRetry: () => ref.invalidate(sellerCatalogProvider(sellerId)),
        ),
      ),
    );
  }
}
