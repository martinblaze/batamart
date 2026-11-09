import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/images/app_network_image.dart';

String formatEventWhen(DateTime? d) =>
    d == null ? 'Date to be announced' : DateFormat('EEE d MMM, h:mm a').format(d);

/// Flyer image at a fixed aspect, with the shared placeholder when missing.
class FlyerImage extends StatelessWidget {
  const FlyerImage({super.key, required this.url, this.aspect = 16 / 9});

  final String url;
  final double aspect;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: aspect,
      child: LayoutBuilder(
        builder: (context, c) =>
            AppNetworkImage(url, width: c.maxWidth, height: c.maxHeight),
      ),
    );
  }
}

/// Small bordered label such as "SOLD OUT" or "CHECKED IN".
class TicketBadge extends StatelessWidget {
  const TicketBadge({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label.toUpperCase(),
        style: AppTypography.label(size: 9, color: color),
      ),
    );
  }
}

/// Icon + text line used for "when" and "where".
class InfoLine extends StatelessWidget {
  const InfoLine({super.key, required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: p.inkMuted),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 13, color: p.inkSecondary, height: 1.4),
          ),
        ),
      ],
    );
  }
}

Color ticketStatusColor(String status) {
  switch (status) {
    case 'VALID':
      return AppColors.success;
    case 'CHECKED_IN':
      return AppColors.primary;
    default:
      return AppColors.danger;
  }
}

String ticketStatusLabel(String status) {
  switch (status) {
    case 'VALID':
      return 'Valid';
    case 'CHECKED_IN':
      return 'Checked in';
    case 'VOID':
    case 'CANCELLED':
      return 'Void';
    default:
      return status.replaceAll('_', ' ');
  }
}

/// Re-exported so screens need only this file for the ticket glyphs.
const ticketIcon = LucideIcons.ticket;
