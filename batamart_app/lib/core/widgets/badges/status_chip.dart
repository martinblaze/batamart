import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';

/// Small pill label used for Order.status everywhere an order is listed
/// (My Orders tabs, Order Tracking, Sales list). Color mapping lives in
/// [AppColors.orderStatus] so it's defined once.
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.label});

  /// Raw `OrderStatus` enum value from the API (e.g. `"ON_THE_WAY"`).
  final String status;

  /// Optional human-friendly override; defaults to a title-cased version
  /// of [status] (`ON_THE_WAY` -> `On The Way`).
  final String? label;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.orderStatus(status);
    final text = label ?? _titleCase(status);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }

  static String _titleCase(String raw) {
    return raw
        .split('_')
        .map((w) => w.isEmpty ? w : '${w[0]}${w.substring(1).toLowerCase()}')
        .join(' ');
  }
}
