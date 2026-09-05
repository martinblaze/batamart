import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../buttons/app_buttons.dart';
import 'empty_state.dart';

/// A failed request. Deliberately the same shape as [EmptyState] — zero
/// results is not an error, and the two must not be confused — but it carries
/// a retry, because the useful thing to offer someone here is another attempt.
class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    this.title = 'Something went wrong',
    this.message,
    this.onRetry,
  });

  final String title;
  final String? message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: DottedBorderBox(
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.section,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  LucideIcons.triangleAlert,
                  size: 28,
                  color: AppColors.danger,
                ),
                const SizedBox(height: AppSpacing.xl),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: AppTypography.display(
                    size: 18,
                    color: p.ink,
                    weight: FontWeight.w600,
                    height: 1.25,
                  ),
                ),
                if (message != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    message!,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: p.inkSecondary,
                      height: 1.55,
                    ),
                  ),
                ],
                if (onRetry != null) ...[
                  const SizedBox(height: AppSpacing.xl),
                  SecondaryButton(
                    label: 'Try again',
                    onPressed: onRetry,
                    expand: false,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
