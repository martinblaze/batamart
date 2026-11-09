import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_palette.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../data/ticket_host_models.dart';

/// Plain-language explanation of the two commission percents.
class CommissionExplainer extends StatelessWidget {
  const CommissionExplainer({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: p.page,
        border: Border.all(color: p.hairline),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.info, size: 16, color: p.inkSecondary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'Commission is what a seller earns for each ticket they sell, as a percent of the ticket price (max $kMaxCommissionPct%). It comes out of your share, not on top of the price.\n\n'
              'Random sellers: any seller who puts your tickets in their shop.\n'
              'Unique sellers: people you name by username below. They earn the unique percent instead.\n\n'
              'Use 0 to pay no commission. BataMart keeps $kPlatformFeePct% of every ticket.',
              style: TextStyle(color: p.inkSecondary, fontSize: 12, height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}
