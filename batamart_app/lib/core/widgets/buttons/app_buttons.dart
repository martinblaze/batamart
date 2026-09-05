import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_palette.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// How far a button compresses when pressed.
///
/// This is the touch equivalent of the web app's magnetic hover: there is no
/// cursor to chase on a phone, so the tactility has to come from the press
/// itself. Small — 2% — and on a long ease-out, so it reads as a considered
/// settle rather than a bounce.
const _pressScale = 0.98;
const _pressCurve = Cubic(0.16, 1, 0.3, 1);

/// Wraps any button in the press-compression gesture.
class _Pressable extends StatefulWidget {
  const _Pressable({required this.child, required this.enabled});

  final Widget child;
  final bool enabled;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (!widget.enabled || _down == v) return;
    setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _down ? _pressScale : 1,
        duration: const Duration(milliseconds: 220),
        curve: _pressCurve,
        child: widget.child,
      ),
    );
  }
}

/// The primary action — solid ink, reversed mono label.
///
/// There is deliberately no gradient. Solid ink carries the action and the
/// accent is spent elsewhere, so exactly one thing on a screen is loud.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final disabled = onPressed == null || isLoading;
    final fg = disabled ? p.inkMuted : p.card;

    final button = _Pressable(
      enabled: !disabled,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: disabled ? p.hairline : p.ink,
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.md),
            onTap: disabled ? null : onPressed,
            splashColor: p.card.withValues(alpha: 0.08),
            highlightColor: p.card.withValues(alpha: 0.05),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Center(
                child: isLoading
                    ? SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: fg,
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (icon != null) ...[
                            Icon(icon, color: fg, size: 16),
                            const SizedBox(width: AppSpacing.sm + 2),
                          ],
                          Text(
                            label.toUpperCase(),
                            style: AppTypography.label(size: 11, color: fg),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ),
    );

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Secondary action — hairline border on the card surface.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final disabled = onPressed == null;
    final fg = disabled ? p.inkMuted : p.ink;

    final button = _Pressable(
      enabled: !disabled,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: p.card,
          border: Border.all(color: p.hairline),
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.md),
            onTap: onPressed,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 16, color: fg),
                      const SizedBox(width: AppSpacing.sm + 2),
                    ],
                    Text(
                      label.toUpperCase(),
                      style: AppTypography.label(size: 11, color: fg),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// Destructive action — remove item, cancel order, delete listing.
class DangerButton extends StatelessWidget {
  const DangerButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final disabled = onPressed == null || isLoading;

    final button = _Pressable(
      enabled: !disabled,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: disabled ? p.hairline : AppColors.danger,
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.md),
            onTap: disabled ? null : onPressed,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Center(
                child: isLoading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (icon != null) ...[
                            Icon(icon, size: 16, color: Colors.white),
                            const SizedBox(width: AppSpacing.sm + 2),
                          ],
                          Text(
                            label.toUpperCase(),
                            style: AppTypography.label(
                              size: 11,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ),
    );

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

/// A quiet text action — "Skip", "Use a different email".
class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: p.inkSecondary,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: p.inkSecondary),
            const SizedBox(width: AppSpacing.sm),
          ],
          Text(
            label.toUpperCase(),
            style: AppTypography.label(size: 10, color: p.inkSecondary),
          ),
        ],
      ),
    );
  }
}
