import 'package:flutter/material.dart';

import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// The vocabulary that carries the editorial system across every screen.
///
/// These five shapes are what the web app repeats everywhere, and they are the
/// reason its screens read as one product rather than fifty. Reach for them
/// before inventing a heading, a divider or a row of figures.

/// A mono uppercase label followed by a hairline that runs to the end of its
/// container. The system's signature element — it sits above section headings
/// throughout, and it is what makes metadata read as an instrument panel.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.label, {super.key, this.icon, this.rule = true, this.color});

  final String label;
  final IconData? icon;

  /// The trailing rule. Turn it off inside a narrow column where it would look
  /// like an accident rather than a device.
  final bool rule;

  /// Overrides the label colour — pass `palette.slabFg` on a dark band.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final fg = color ?? p.inkMuted;

    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: AppSpacing.sm),
        ],
        Text(label.toUpperCase(), style: AppTypography.label(size: 11, color: fg)),
        if (rule) ...[
          const SizedBox(width: AppSpacing.md),
          Expanded(child: Container(height: 1, color: fg.withValues(alpha: 0.28))),
        ],
      ],
    );
  }
}

/// A section opener: eyebrow, display title, optional standfirst and action.
///
/// [accent] sets one word of the title in italic serif — "Campus *sellers*".
/// One per screen; twice and it stops reading as editorial.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.eyebrow,
    this.accent,
    this.description,
    this.action,
    this.size = 26,
  });

  final String title;
  final String? eyebrow;
  final String? accent;
  final String? description;
  final Widget? action;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (eyebrow != null) ...[
          Eyebrow(eyebrow!),
          const SizedBox(height: AppSpacing.lg),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Text.rich(
                TextSpan(
                  text: title,
                  style: AppTypography.display(size: size, color: p.ink),
                  children: accent == null
                      ? null
                      : [
                          TextSpan(
                            text: ' $accent',
                            style: AppTypography.serif(size: size + 2, color: p.ink),
                          ),
                        ],
                ),
              ),
            ),
            if (action != null) ...[
              const SizedBox(width: AppSpacing.lg),
              action!,
            ],
          ],
        ),
        if (description != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            description!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: p.inkSecondary,
              height: 1.55,
            ),
          ),
        ],
      ],
    );
  }
}

/// One figure in a [StatRail].
class Stat {
  const Stat({required this.value, required this.label, this.note, this.tone});

  final String value;
  final String label;
  final String? note;

  /// Only for a figure that genuinely needs attention. Left null, the figure is
  /// neutral — which is what nearly all of them should be.
  final Color? tone;
}

/// A hairline grid of figures — the house pattern for any set of numbers.
///
/// Cells butt together with a 1px rule between them rather than floating as
/// separate cards, which is what keeps a row of stats reading as one object.
class StatRail extends StatelessWidget {
  const StatRail({super.key, required this.stats, this.columns});

  final List<Stat> stats;

  /// Defaults to the number of stats, capped at three so labels never crush.
  final int? columns;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final cols = columns ?? (stats.length > 3 ? 3 : stats.length);
    if (stats.isEmpty) return const SizedBox.shrink();

    final rows = <Widget>[];
    for (var i = 0; i < stats.length; i += cols) {
      final slice = stats.skip(i).take(cols).toList();
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var j = 0; j < slice.length; j++) ...[
                if (j > 0) Container(width: 1, color: p.hairline),
                Expanded(child: _cell(context, slice[j])),
              ],
              // Keep the last row's cells the same width as a full row's.
              for (var k = slice.length; k < cols; k++) ...[
                Container(width: 1, color: p.hairline),
                const Expanded(child: SizedBox.shrink()),
              ],
            ],
          ),
        ),
      );
      if (i + cols < stats.length) {
        rows.add(Container(height: 1, color: p.hairline));
      }
    }

    return DecoratedBox(
      decoration: BoxDecoration(border: Border.all(color: p.hairline)),
      child: Column(children: rows),
    );
  }

  Widget _cell(BuildContext context, Stat s) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            s.value,
            style: AppTypography.figure(size: 24, color: s.tone ?? p.ink),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(s.label.toUpperCase(), style: AppTypography.label(size: 10, color: p.inkMuted)),
          if (s.note != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              s.note!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: p.inkMuted),
            ),
          ],
        ],
      ),
    );
  }
}

/// A label/value pair with a hairline beneath. For totals, specs and summaries.
class DataRow2 extends StatelessWidget {
  const DataRow2({
    super.key,
    required this.label,
    required this.value,
    this.valueWidget,
    this.emphasis = false,
    this.divider = true,
  });

  final String label;
  final String value;

  /// Use instead of [value] when the right-hand side is a badge or chip.
  final Widget? valueWidget;

  /// Totals get the display face at a larger size.
  final bool emphasis;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: AppTypography.label(
                    size: 10,
                    color: emphasis ? p.ink : p.inkSecondary,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.lg),
              valueWidget ??
                  Text(
                    value,
                    textAlign: TextAlign.right,
                    style: emphasis
                        ? AppTypography.figure(size: 18, color: p.ink)
                        : Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: p.ink,
                            fontWeight: FontWeight.w500,
                          ),
                  ),
            ],
          ),
        ),
        if (divider) Container(height: 1, color: p.hairline),
      ],
    );
  }
}

/// A bordered surface with hairline edges and no shadow.
class Panel extends StatelessWidget {
  const Panel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.color,
  });

  final Widget child;
  final EdgeInsets padding;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color ?? p.card,
        border: Border.all(color: p.hairline),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// A full-bleed dark band that stays dark in both themes.
///
/// Use for trust banners and hero strips. Reaching for `palette.ink` instead
/// would invert the band to cream in dark mode and take its light text with it.
class Slab extends StatelessWidget {
  const Slab({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.symmetric(
      horizontal: AppSpacing.lg,
      vertical: AppSpacing.xl,
    ),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      width: double.infinity,
      color: p.slab,
      padding: padding,
      child: DefaultTextStyle.merge(
        style: TextStyle(color: p.slabFg),
        child: IconTheme.merge(
          data: IconThemeData(color: p.slabFg),
          child: child,
        ),
      ),
    );
  }
}

/// Staggers children in on first build — the mobile stand-in for the web's
/// scroll-triggered reveals. Roughly 30ms apart, from a visible resting state
/// so nothing is ever stuck invisible if the animation is skipped.
class StaggerIn extends StatelessWidget {
  const StaggerIn({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return child;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 420),
      curve: Cubic(0.16, 1, 0.3, 1),
      // Cap the delay so item 40 in a long list is not held back for a second.
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, (1 - t) * 10), child: child),
      ),
      child: child,
    );
  }
}
