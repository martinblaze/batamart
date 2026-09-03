import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';

/// User.trustLevel badge (BRONZE/SILVER/GOLD/VERIFIED) shown next to a
/// seller/rider name.
class TrustBadge extends StatelessWidget {
  const TrustBadge({super.key, required this.level});

  final String level;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.trustLevel(level);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            level == 'VERIFIED' ? LucideIcons.badgeCheck : LucideIcons.shield,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            level[0] + level.substring(1).toLowerCase(),
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
