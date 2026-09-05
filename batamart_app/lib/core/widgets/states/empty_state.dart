import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../buttons/app_buttons.dart';

/// The empty state.
///
/// A campus marketplace is genuinely empty for its first weeks, so this is not
/// a rare edge — for early users it *is* the product. The dashed hairline
/// gives the space a defined edge rather than leaving a void, and the copy
/// always names what fills it plus the action that does the filling.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = LucideIcons.inbox,
    this.actionLabel,
    this.onActionTap,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onActionTap;

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
                Icon(icon, size: 28, color: p.inkMuted),
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
                if (actionLabel != null) ...[
                  const SizedBox(height: AppSpacing.xl),
                  PrimaryButton(
                    label: actionLabel!,
                    onPressed: onActionTap,
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

/// A dashed hairline rectangle. Flutter has no dashed border out of the box,
/// so this paints one — used to mark a space that is waiting to be filled.
class DottedBorderBox extends StatelessWidget {
  const DottedBorderBox({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedRectPainter(color: context.palette.hairline),
      child: child,
    );
  }
}

class _DashedRectPainter extends CustomPainter {
  _DashedRectPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    const dash = 4.0;
    const gap = 4.0;

    void line(Offset from, Offset to) {
      final total = (to - from).distance;
      if (total == 0) return;
      final step = (to - from) / total;
      var travelled = 0.0;
      while (travelled < total) {
        final end = travelled + dash > total ? total : travelled + dash;
        canvas.drawLine(from + step * travelled, from + step * end, paint);
        travelled = end + gap;
      }
    }

    final r = Offset.zero & size;
    line(r.topLeft, r.topRight);
    line(r.topRight, r.bottomRight);
    line(r.bottomRight, r.bottomLeft);
    line(r.bottomLeft, r.topLeft);
  }

  @override
  bool shouldRepaint(_DashedRectPainter old) => old.color != color;
}
