import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/campaign_badge.dart';
import '../../../core/widgets/badges/trust_badge.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../state/products_providers.dart';

/// WEB_PAGES_REFERENCE.md's "Seller Directory" ("public, searchable list
/// of sellers") has no backing endpoint in BACKEND_REFERENCE.md — there is
/// no `GET /api/sellers` list route, only per-product `seller` sub-objects
/// and `/api/sellers/{id}/reviews`. This derives a directory client-side
/// from sellers seen in the marketplace feed (`sellerDirectoryProvider`),
/// which is necessarily incomplete — a seller with no product currently in
/// the feed won't appear. Flagged in README "Phase 4 status".
class SellerDirectoryScreen extends ConsumerWidget {
  const SellerDirectoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sellersAsync = ref.watch(sellerDirectoryProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Sellers', showBack: true),
      body: sellersAsync.when(
        data: (sellers) {
          if (sellers.isEmpty) {
            return const EmptyState(
              title: 'No sellers to show yet',
              message: 'Browse the marketplace first to discover sellers.',
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(sellerDirectoryProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: sellers.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final seller = sellers[index];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundImage: seller.profilePhoto != null
                        ? CachedNetworkImageProvider(seller.profilePhoto!)
                        : null,
                    child: seller.profilePhoto == null
                        ? const Icon(Icons.storefront)
                        : null,
                  ),
                  title: Text(seller.name),
                  subtitle: Row(
                    children: [
                      TrustBadge(level: seller.trustLevel),
                      const SizedBox(width: AppSpacing.sm),
                      RatingStars(rating: seller.avgRating, size: 12),
                    ],
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push(
                    AppRoutes.sellerProfilePath(seller.id),
                    extra: seller,
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load sellers.\n$error',
          onRetry: () => ref.invalidate(sellerDirectoryProvider),
        ),
      ),
    );
  }
}
