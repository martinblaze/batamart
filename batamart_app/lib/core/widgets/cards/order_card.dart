import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../badges/status_chip.dart';
import '../buttons/app_buttons.dart';

/// Order summary row used in My Orders / Sales / Order Tracking lists —
/// order number, date, item count, total, status chip, and up to two
/// actions. One action ("View Details", "Accept") renders full-width and
/// filled; a second ("Review", alongside "View Details" per the mockup's
/// Delivered state) renders outlined, matching the collage exactly.
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
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  orderNumber,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                StatusChip(status: status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              date,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  itemsLabel,
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
                Text(
                  total,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            if (actionLabel != null && secondaryActionLabel != null) ...[
              const SizedBox(height: AppSpacing.sm),
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
                      expand: true,
                    ),
                  ),
                ],
              ),
            ] else if (actionLabel != null) ...[
              const SizedBox(height: AppSpacing.sm),
              PrimaryButton(
                label: actionLabel!,
                onPressed: onActionTap,
                expand: true,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
