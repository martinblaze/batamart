/// Spacing and radius scale used across every screen, so no feature
/// re-derives its own numbers.
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// Between major sections. This system is deliberately generous — the space
  /// is what makes a screen read as composed rather than packed.
  static const double section = 40;

  /// Screen edge inset.
  static const double gutter = 16;
}

/// Sharp edges are a brand rule, not an oversight.
///
/// The whole scale is flattened to a near-square 2px rather than removed, so
/// the ~88 existing `AppRadii.*` call sites tighten at once instead of needing
/// to be rewritten one by one. [pill] is left alone so avatars, status dots and
/// toggles stay properly circular.
class AppRadii {
  AppRadii._();

  static const double sm = 2;
  static const double md = 2;
  static const double lg = 2;
  static const double xl = 3;

  /// Fully-rounded. Avatars, status dots, and nothing else.
  static const double pill = 999;
}
