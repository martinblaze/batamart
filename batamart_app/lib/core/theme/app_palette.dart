import 'package:flutter/material.dart';

/// The neutrals, as a [ThemeExtension] so they actually flip between light and
/// dark.
///
/// The previous approach kept every neutral as a `static const` on
/// `AppColors`, which meant any widget reading `AppColors.textSecondary`
/// directly rendered its light value on a dark ground — dark mode only worked
/// for widgets that happened to go through `Theme.of(context)`. Resolving them
/// through the theme is what makes a single widget correct in both.
///
/// Read them with the `context.palette` getter at the bottom of this file:
///
/// ```dart
/// Text('Ready', style: TextStyle(color: context.palette.inkSecondary))
/// ```
///
/// Fixed brand and status colours that mean the same thing on either ground
/// (success, danger, the campaign rose, trust tiers) stay on `AppColors`.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({
    required this.page,
    required this.card,
    required this.ink,
    required this.inkSecondary,
    required this.inkMuted,
    required this.hairline,
    required this.hairlineStrong,
    required this.accent,
    required this.slab,
    required this.slabFg,
  });

  /// The screen's ground. Warm bone, not white — cards sit *above* it.
  final Color page;

  /// A raised surface. White in light; a step lighter than [page] in dark,
  /// because raising a surface in the dark means lightening it.
  final Color card;

  /// Primary text, and the fill for primary buttons.
  final Color ink;
  final Color inkSecondary;
  final Color inkMuted;

  /// 1px rules. The main structural device in this system — used instead of
  /// shadows and rounded card borders.
  final Color hairline;

  /// The same rule at hover/emphasis weight.
  final Color hairlineStrong;

  /// The one accent. Appears roughly once per screen.
  final Color accent;

  /// A full-bleed dark band that stays dark in *both* themes, with light text
  /// on it. Distinct from [ink], which inverts: a hero rendered with [ink]
  /// flips to a cream slab in dark mode and takes its white text with it.
  final Color slab;
  final Color slabFg;

  static const light = AppPalette(
    page: Color(0xFFF6F4F1),
    card: Color(0xFFFFFFFF),
    ink: Color(0xFF131311),
    inkSecondary: Color(0xFF6E6A63),
    inkMuted: Color(0xFF9A958C),
    hairline: Color(0xFFE4E0D9),
    hairlineStrong: Color(0xFFC9C3B8),
    accent: Color(0xFF1E90FF),
    slab: Color(0xFF131311),
    slabFg: Color(0xFFF6F4F1),
  );

  static const dark = AppPalette(
    page: Color(0xFF0B0B0A),
    card: Color(0xFF161614),
    ink: Color(0xFFF0ECE4),
    inkSecondary: Color(0xFFA5A199),
    inkMuted: Color(0xFF736F68),
    hairline: Color(0xFF2B2A26),
    hairlineStrong: Color(0xFF433F39),
    accent: Color(0xFF4DABFF),
    slab: Color(0xFF24231F),
    slabFg: Color(0xFFF0ECE4),
  );

  @override
  AppPalette copyWith({
    Color? page,
    Color? card,
    Color? ink,
    Color? inkSecondary,
    Color? inkMuted,
    Color? hairline,
    Color? hairlineStrong,
    Color? accent,
    Color? slab,
    Color? slabFg,
  }) {
    return AppPalette(
      page: page ?? this.page,
      card: card ?? this.card,
      ink: ink ?? this.ink,
      inkSecondary: inkSecondary ?? this.inkSecondary,
      inkMuted: inkMuted ?? this.inkMuted,
      hairline: hairline ?? this.hairline,
      hairlineStrong: hairlineStrong ?? this.hairlineStrong,
      accent: accent ?? this.accent,
      slab: slab ?? this.slab,
      slabFg: slabFg ?? this.slabFg,
    );
  }

  @override
  AppPalette lerp(covariant ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      page: Color.lerp(page, other.page, t)!,
      card: Color.lerp(card, other.card, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      inkSecondary: Color.lerp(inkSecondary, other.inkSecondary, t)!,
      inkMuted: Color.lerp(inkMuted, other.inkMuted, t)!,
      hairline: Color.lerp(hairline, other.hairline, t)!,
      hairlineStrong: Color.lerp(hairlineStrong, other.hairlineStrong, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      slab: Color.lerp(slab, other.slab, t)!,
      slabFg: Color.lerp(slabFg, other.slabFg, t)!,
    );
  }
}

extension AppPaletteX on BuildContext {
  /// The active neutrals. Falls back to the light set if the extension is
  /// somehow missing, so a widget can never crash on a null palette.
  AppPalette get palette =>
      Theme.of(this).extension<AppPalette>() ?? AppPalette.light;

  /// True when the app is on the dark ground. Use sparingly — prefer reading a
  /// token that already differs per theme over branching on this.
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}
