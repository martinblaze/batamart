import 'package:flutter/material.dart';

import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// The one text input for the whole app.
///
/// The label sits *above* the field as a mono eyebrow rather than floating
/// inside it. A floating Material label animates away the moment someone types,
/// which means the one piece of context they need while filling a long form —
/// what this field is — disappears exactly when they are looking at it. It also
/// keeps every field the same height whether or not it is filled.
///
/// The rest of the styling comes from `InputDecorationTheme` in [AppTheme], so
/// this widget only owns the label, the hint row and the error text.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.helper,
    this.obscureText = false,
    this.keyboardType,
    this.prefixIcon,
    this.suffixIcon,
    this.maxLines = 1,
    this.maxLength,
    this.enabled = true,
    this.required = false,
    this.autofillHints,
    this.textInputAction,
    this.onChanged,
    this.onFieldSubmitted,
    this.validator,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;

  /// A line of guidance under the field — why it is needed, or the format.
  final String? helper;

  final bool obscureText;
  final TextInputType? keyboardType;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final int maxLines;
  final int? maxLength;
  final bool enabled;

  /// Appends a marker to the label. Marking the few required fields reads
  /// better than marking the many optional ones.
  final bool required;

  final Iterable<String>? autofillHints;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Row(
            children: [
              Text(
                label!.toUpperCase(),
                style: AppTypography.label(size: 10, color: p.inkSecondary),
              ),
              if (required)
                Text(
                  ' *',
                  style: AppTypography.label(size: 10, color: p.inkMuted),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          maxLines: obscureText ? 1 : maxLines,
          maxLength: maxLength,
          enabled: enabled,
          autofillHints: autofillHints,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onFieldSubmitted: onFieldSubmitted,
          validator: validator,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: p.ink),
          cursorColor: p.ink,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: prefixIcon == null
                ? null
                : Icon(prefixIcon, size: 18, color: p.inkMuted),
            suffixIcon: suffixIcon,
            // The character counter duplicates the label row's job and adds a
            // second baseline under every field; the maxLength still applies.
            counterText: '',
          ),
        ),
        if (helper != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            helper!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: p.inkMuted,
            ),
          ),
        ],
      ],
    );
  }
}
