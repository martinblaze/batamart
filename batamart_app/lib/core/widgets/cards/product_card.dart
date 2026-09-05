import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../badges/campaign_badge.dart';
import '../images/app_network_image.dart';

/// The product tile — the most-repeated object in the app.
///
/// Deliberately *not* a card: no border, no fill, no shadow. The photograph is
/// the object and the metadata sits quietly beneath it, which is what lets a
/// grid of twelve read as a catalogue rather than twelve boxes. Flags sit on
/// the image itself, so nothing competes with the photo for the tile's edge.
///
/// The image is 4:5 rather than square — the taller crop gives a column of
/// tiles a stronger vertical rhythm and suits how people photograph goods.
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
    this.category,
    this.soldOut = false,
    this.campaignTag,
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

  /// `Product.landmark` — the campus zone it ships from.
  final String? location;

  /// Shown as the mono eyebrow above the name.
  final String? category;

  final bool soldOut;
  final String? campaignTag;
  final bool isFavorite;
  final VoidCallback? onTap;
  final VoidCallback? onFavoriteTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return InkWell(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 4 / 5,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  color: p.page,
                  child: AppNetworkImage(imageUrl, fit: BoxFit.cover),
                ),

                if (soldOut)
                  Container(
                    color: p.slab.withValues(alpha: 0.55),
                    alignment: Alignment.center,
                    child: Text(
                      'SOLD OUT',
                      style: AppTypography.label(size: 11, color: p.slabFg),
                    ),
                  ),

                // One flag, top-left. The discount is the story on a deals
                // grid, so it wins over every other possible label.
                Positioned(
                  top: AppSpacing.sm,
                  left: AppSpacing.sm,
                  child: Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      if (percentOff != null && percentOff! > 0)
                        _Flag(label: '-$percentOff%', background: p.slab, foreground: p.slabFg),
                      if (campaignTag != null) CampaignBadge(tag: campaignTag!),
                    ],
                  ),
                ),

                if (onFavoriteTap != null)
                  Positioned(
                    top: AppSpacing.sm,
                    right: AppSpacing.sm,
                    child: _IconPill(
                      icon: isFavorite ? LucideIcons.heart : LucideIcons.heart,
                      filled: isFavorite,
                      onTap: onFavoriteTap!,
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          if (category != null) ...[
            Text(
              category!.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.label(size: 9, color: p.inkMuted),
            ),
            const SizedBox(height: AppSpacing.xs + 2),
          ],

          Text(
            name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: p.ink,
              fontWeight: FontWeight.w500,
              height: 1.35,
            ),
          ),

          const SizedBox(height: AppSpacing.sm),

          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  price,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.figure(size: 16, color: p.ink),
                ),
              ),
              if (originalPrice != null) ...[
                const SizedBox(width: AppSpacing.sm),
                Text(
                  originalPrice!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: p.inkMuted,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
              ],
            ],
          ),

          if (rating != null || location != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                if (rating != null) ...[
                  const Icon(LucideIcons.star, size: 11, color: AppColors.star),
                  const SizedBox(width: 3),
                  Text(
                    rating!.toStringAsFixed(1),
                    style: AppTypography.label(size: 9, color: p.inkSecondary),
                  ),
                  if (reviewCount != null) ...[
                    const SizedBox(width: 3),
                    Text(
                      '($reviewCount)',
                      style: AppTypography.label(size: 9, color: p.inkMuted),
                    ),
                  ],
                ],
                if (rating != null && location != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                    child: Container(width: 1, height: 9, color: p.hairline),
                  ),
                if (location != null)
                  Flexible(
                    child: Text(
                      location!.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.label(size: 9, color: p.inkMuted),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A solid flag on the photograph. Solid rather than tinted because it has to
/// hold at any brightness the photo happens to be.
class _Flag extends StatelessWidget {
  const _Flag({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      color: background,
      child: Text(label, style: AppTypography.label(size: 9, color: foreground)),
    );
  }
}

class _IconPill extends StatelessWidget {
  const _IconPill({
    required this.icon,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Material(
      color: p.card.withValues(alpha: 0.92),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(7),
          child: Icon(
            icon,
            size: 14,
            color: filled ? AppColors.danger : p.inkSecondary,
          ),
        ),
      ),
    );
  }
}
