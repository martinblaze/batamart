import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_palette.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

String formatWhen(DateTime? d) =>
    d == null ? 'Not set' : DateFormat('EEE d MMM yyyy, h:mm a').format(d);

String formatShort(DateTime? d) =>
    d == null ? '' : DateFormat('d MMM, h:mm a').format(d);

/// Human label for an event status.
String eventStatusLabel(String status) {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Pending review';
    case 'ACTIVE':
      return 'Live';
    case 'REJECTED':
      return 'Rejected';
    case 'PAUSED':
      return 'Paused';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status.replaceAll('_', ' ');
  }
}

/// Pending / live / rejected / paused / cancelled, as a hairline-ringed chip
/// in the same style as the order [StatusChip].
class EventStatusChip extends StatelessWidget {
  const EventStatusChip({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final Color color;
    switch (status) {
      case 'ACTIVE':
        color = AppColors.success;
      case 'PENDING_REVIEW':
        color = AppColors.warning;
      case 'REJECTED':
      case 'CANCELLED':
        color = AppColors.danger;
      default:
        color = context.palette.inkMuted;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        border: Border.all(color: color.withValues(alpha: 0.30)),
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(
        eventStatusLabel(status).toUpperCase(),
        style: AppTypography.label(size: 10, color: color),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(
        text.toUpperCase(),
        style: AppTypography.label(size: 10, color: context.palette.inkSecondary),
      ),
    );
  }
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.emphasis = false});
  final String label;
  final String value;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: p.card,
        border: Border.all(color: emphasis ? p.ink : p.hairline),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: AppTypography.display(size: 18, weight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: p.inkSecondary, fontSize: 11)),
        ],
      ),
    );
  }
}

/// A hairline-ringed container for list rows and panels.
class PanelCard extends StatelessWidget {
  const PanelCard({super.key, required this.child, this.onTap, this.padding});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Material(
        color: p.card,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: p.hairline),
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: Padding(
            padding: padding ?? const EdgeInsets.all(AppSpacing.md),
            child: child,
          ),
        ),
      ),
    );
  }
}

class InlineError extends StatelessWidget {
  const InlineError(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2),
          child: Icon(LucideIcons.circleAlert, size: 16, color: AppColors.danger),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(message, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
        ),
      ],
    );
  }
}

/// A tappable field that opens the date then time pickers. Optional values
/// show a clear button.
class DateTimeField extends StatelessWidget {
  const DateTimeField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.required = false,
    this.firstDate,
    this.helper,
  });

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final bool required;
  final DateTime? firstDate;
  final String? helper;

  Future<void> _pick(BuildContext context) async {
    final now = DateTime.now();
    final first = firstDate ?? now;
    final initial = value ?? now.add(const Duration(days: 7));
    final date = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(first) ? first : initial,
      firstDate: DateTime(first.year, first.month, first.day),
      lastDate: now.add(const Duration(days: 365 * 3)),
    );
    if (date == null || !context.mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(value ?? DateTime(2000, 1, 1, 18)),
    );
    if (time == null) return;
    onChanged(DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label.toUpperCase(),
              style: AppTypography.label(size: 10, color: p.inkSecondary),
            ),
            if (required)
              Text(' *', style: AppTypography.label(size: 10, color: p.inkMuted)),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        InkWell(
          onTap: () => _pick(context),
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            decoration: BoxDecoration(
              border: Border.all(color: p.hairline),
              borderRadius: BorderRadius.circular(AppRadii.md),
              color: p.card,
            ),
            child: Row(
              children: [
                Icon(LucideIcons.calendar, size: 18, color: p.inkMuted),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    value == null ? 'Tap to choose' : formatWhen(value),
                    style: TextStyle(color: value == null ? p.inkMuted : p.ink),
                  ),
                ),
                if (value != null && !required)
                  InkWell(
                    onTap: () => onChanged(null),
                    child: Icon(LucideIcons.x, size: 16, color: p.inkMuted),
                  ),
              ],
            ),
          ),
        ),
        if (helper != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(helper!, style: TextStyle(color: p.inkMuted, fontSize: 12)),
        ],
      ],
    );
  }
}

/// Small removable chip used for the checker emails and seller usernames.
class RemovableChip extends StatelessWidget {
  const RemovableChip({super.key, required this.label, required this.onRemove});
  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.only(left: AppSpacing.md, top: 4, bottom: 4, right: 4),
      decoration: BoxDecoration(
        border: Border.all(color: p.hairline),
        color: p.card,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
          IconButton(
            visualDensity: VisualDensity.compact,
            tooltip: 'Remove',
            iconSize: 16,
            onPressed: onRemove,
            icon: const Icon(LucideIcons.x),
          ),
        ],
      ),
    );
  }
}
