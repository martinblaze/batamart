import 'package:flutter/material.dart';

import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../badges/status_chip.dart';
import '../buttons/app_buttons.dart';

/// One order, in My Orders / Sales / tracking lists.
///
/// The order number is mono and the total is the display face with tabular
/// figures, so a column of orders lines up down the page instead of jittering
/// with each amount's digit widths. That alignment is most of why a list of
/// records reads as a ledger rather than a pile of cards.
class OrderCard extends StatelessWidget {
  const OrderCard({
    super.key,
    required this.orderNumber,
    required this.date,
    required this.itemsLabel,
    required this.total,
    required this.status,
    this.actionLabel,
    this.onActionTap,
    this.secondaryActionLabel,
    this.onSecondaryActionTap,
    this.onTap,
  });

  final String orderNumber;
  final String date;
  final String itemsLabel;
  final String total;
  final String status;
  final String? actionLabel;
  final VoidCallback? onActionTap;
  final String? secondaryActionLabel;
  final VoidCallback? onSecondaryActionTap;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: p.card,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: p.hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        orderNumber.toUpperCase(),
                        style: AppTypography.label(size: 10, color: p.inkMuted),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        total,
                        style: AppTypography.figure(size: 20, color: p.ink),
                      ),
                    ],
                  ),
                ),
                StatusChip(status: status),
              ],
            ),

            const SizedBox(height: AppSpacing.md),
            Container(height: 1, color: p.hairline),
            const SizedBox(height: AppSpacing.md),

            Row(
              children: [
                Expanded(
                  child: Text(
                    itemsLabel,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: p.inkSecondary,
                    ),
                  ),
                ),
                Text(
                  date.toUpperCase(),
                  style: AppTypography.label(size: 9, color: p.inkMuted),
                ),
              ],
            ),

            if (actionLabel != null && secondaryActionLabel != null) ...[
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: SecondaryButton(
                      label: secondaryActionLabel!,
                      onPressed: onSecondaryActionTap,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: PrimaryButton(
                      label: actionLabel!,
                      onPressed: onActionTap,
                    ),
                  ),
                ],
              ),
            ] else if (actionLabel != null) ...[
              const SizedBox(height: AppSpacing.lg),
              PrimaryButton(label: actionLabel!, onPressed: onActionTap),
            ],
          ],
        ),
      ),
    );
  }
}
