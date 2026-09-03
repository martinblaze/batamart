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
}

class AppRadii {
  AppRadii._();

  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  /// Fully-rounded "pill" shape used by the mockups' primary buttons and
  /// active category tabs.
  static const double pill = 999;
}
