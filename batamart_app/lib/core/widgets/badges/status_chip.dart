import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// Order.status label, everywhere an order is listed.
///
/// Mono and uppercase with a hairline ring rather than a solid pill: a list of
/// twelve orders should read as a column of records, not twelve coloured
/// lozenges competing for the eye. The colour mapping lives in
/// [AppColors.orderStatus] so it is defined once.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.label});

  /// Raw `OrderStatus` enum value from the API (e.g. `"ON_THE_WAY"`).
  final String status;

  /// Optional human-friendly override; defaults to the enum value with
  /// underscores replaced (`ON_THE_WAY` -> `ON THE WAY`).
  final String? label;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final color = AppColors.orderStatus(status, neutral: p.inkMuted);
    final text = (label ?? status.replaceAll('_', ' ')).toUpperCase();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.30)),
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(text, style: AppTypography.label(size: 10, color: color)),
    );
  }
}
