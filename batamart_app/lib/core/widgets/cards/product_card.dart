import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../badges/campaign_badge.dart';
import '../images/app_network_image.dart';

/// Product tile used in marketplace grids (Hot Deals, Just Dropped, Deals
/// grid, "You may also like"). Matches the mockups' card shape: image with
/// a corner discount badge, name, price (+ struck-through original price
/// when discounted), rating.
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.imageUrl,
    required this.name,
    required this.price,
    this.originalPrice,
    this.percentOff,
    this.rating,
    this.reviewCount,
    this.location,
    this.isFavorite = false,
    this.onTap,
    this.onFavoriteTap,
  });

  final String imageUrl;
  final String name;
  final String price;
  final String? originalPrice;
  final int? percentOff;
  final double? rating;
  final int? reviewCount;

  /// `Product.landmark` — shown as a small pin+text row under the rating,
  /// matching the web card's location pill (`ProductCard.tsx`).
  final String? location;
  final bool isFavorite;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                children: [
                  Positioned.fill(child: AppNetworkImage(imageUrl)),
                  if (percentOff != null)
                    Positioned(
                      top: AppSpacing.sm,
                      left: AppSpacing.sm,
                      child: DiscountBadge(percentOff: percentOff!),
                    ),
                  Positioned(
                    top: AppSpacing.sm,
                    right: AppSpacing.sm,
                    child: GestureDetector(
                      onTap: onFavoriteTap,
                      child: CircleAvatar(
                        radius: 14,
                        backgroundColor: Colors.white.withValues(alpha: 0.9),
                        child: Icon(
                          LucideIcons.heart,
                          size: 14,
                          color: isFavorite
                              ? AppColors.danger
                              : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        price,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: AppColors.primary,
                        ),
                      ),
                      if (originalPrice != null) ...[
                        const SizedBox(width: 6),
                        Text(
                          originalPrice!,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (rating != null) ...[
                    const SizedBox(height: 4),
                    RatingStars(
                      rating: rating!,
                      reviewCount: reviewCount,
                      size: 12,
                    ),
                  ],
                  if (location != null && location!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.mapPin,
                          size: 11,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            location!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
