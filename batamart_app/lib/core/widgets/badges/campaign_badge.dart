import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';

/// Product.campaignTag / Order.campaignTag badge (free string, e.g.
/// `"GIRLFRIENDS_DAY"` — BACKEND_REFERENCE.md §4.9). Renders a
/// human-friendly label; the exact promo copy/art for each campaign is a
/// per-campaign asset, not something this chip hardcodes.
class CampaignBadge extends StatelessWidget {
  const CampaignBadge({super.key, required this.tag});

  final String tag;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: AppColors.campaignRose,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(
        _label(tag),
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }

  static String _label(String tag) {
    return tag
        .split('_')
        .map((w) => w.isEmpty ? w : '${w[0]}${w.substring(1).toLowerCase()}')
        .join(' ');
  }
}

/// Discount-percentage badge on a product thumbnail (e.g. "-25%").
class DiscountBadge extends StatelessWidget {
  const DiscountBadge({super.key, required this.percentOff});

  final int percentOff;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.danger,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(
        '-$percentOff%',
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}

/// Star rating readout ("4.6 (128)") shown on product cards / detail pages.
class RatingStars extends StatelessWidget {
  const RatingStars({
    super.key,
    required this.rating,
    this.reviewCount,
    this.size = 14,
  });

  final double rating;
  final int? reviewCount;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, color: AppColors.star, size: size),
        const SizedBox(width: 2),
        Text(
          rating.toStringAsFixed(1),
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: size - 1),
        ),
        if (reviewCount != null) ...[
          const SizedBox(width: 2),
          Text(
            '($reviewCount)',
            style: TextStyle(
              color: context.palette.inkSecondary,
              fontSize: size - 2,
            ),
          ),
        ],
      ],
    );
  }
}
