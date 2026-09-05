import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// User.trustLevel badge shown beside a seller or rider name.
///
/// Bronze and Silver are deliberately neutral — a directory of sellers is
/// mostly those two, and colouring every one of them turns the list into
/// noise. Only Gold and Verified earn a hue, which is what makes them read as
/// an achievement.
class TrustBadge extends StatelessWidget {
  const TrustBadge({super.key, required this.level});

  final String level;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final isEarned = level == 'GOLD' || level == 'VERIFIED';
    final color = isEarned ? AppColors.trustLevel(level) : p.inkSecondary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: isEarned ? color.withValues(alpha: 0.10) : Colors.transparent,
        border: Border.all(
          color: isEarned ? color.withValues(alpha: 0.30) : p.hairline,
        ),
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isEarned) ...[
            Icon(
              level == 'VERIFIED' ? LucideIcons.badgeCheck : LucideIcons.crown,
              size: 11,
              color: color,
            ),
            const SizedBox(width: 4),
          ],
          Text(level.toUpperCase(), style: AppTypography.label(size: 9, color: color)),
        ],
      ),
    );
  }
}
