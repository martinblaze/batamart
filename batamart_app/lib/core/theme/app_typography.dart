import 'package:flutter/material.dart';

/// Four faces, each with exactly one job. This is the same type system the web
/// app runs, so the two surfaces genuinely match rather than merely rhyme.
///
/// * **Archivo** — headings, prices, any figure that carries weight. A tight
///   grotesque; the negative tracking is what makes a heading feel set rather
///   than typed.
/// * **Inter** — running text and UI labels. Deliberately neutral, because the
///   personality is carried by the other three.
/// * **Instrument Serif**, italic — the editorial accent, rationed to a word or
///   two per screen. Used *inside* a heading: "Campus *sellers*".
/// * **JetBrains Mono** — eyebrows, metadata, badges, timestamps. Uppercase and
///   widely tracked, so metadata reads as an instrument panel rather than as
///   more prose.
class AppTypography {
  AppTypography._();

  // Family names as declared in pubspec.yaml. Bundled assets, so there is no
  // network path and no silent fallback.
  static const _body = 'Inter';
  static const _display = 'Archivo';
  static const _serif = 'InstrumentSerif';
  static const _mono = 'JetBrainsMono';

  /// Applies the bundled body face across a [TextTheme]. Replaces
  /// `GoogleFonts.interTextTheme`, which resolved to nothing here.
  static TextTheme _interTextTheme(TextTheme base) => base.apply(
    fontFamily: _body,
  );

  static TextTheme textTheme({
    required Color bodyColor,
    required Color secondaryColor,
  }) => _textTheme(bodyColor: bodyColor, secondaryColor: secondaryColor);

  /// The display face on its own, for one-off headings that need a size the
  /// scale doesn't carry.
  static TextStyle display({
    required double size,
    Color? color,
    FontWeight weight = FontWeight.w700,
    double height = 1.04,
  }) => TextStyle(
    fontFamily: _display,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: size * -0.035,
  );

  /// Prices, balances, counts. Tabular figures so columns of money line up —
  /// without this, every total in a list jitters by a few pixels.
  static TextStyle figure({
    required double size,
    Color? color,
    FontWeight weight = FontWeight.w700,
  }) => TextStyle(
    fontFamily: _display,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: 1.05,
    letterSpacing: size * -0.03,
    fontFeatures: const [FontFeature.tabularFigures()],
  );

  /// The editorial accent. One or two words, never a whole line.
  static TextStyle serif({
    required double size,
    Color? color,
    double height = 1.04,
  }) => TextStyle(
    fontFamily: _serif,
    fontSize: size,
    fontStyle: FontStyle.italic,
    fontWeight: FontWeight.w400,
    color: color,
    height: height,
    letterSpacing: size * -0.015,
  );

  /// Eyebrows, badges, metadata. Always uppercase at the call site.
  static TextStyle label({
    double size = 11,
    Color? color,
    FontWeight weight = FontWeight.w500,
  }) => TextStyle(
    fontFamily: _mono,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: 1.3,
    letterSpacing: size * 0.16,
  );

  static TextTheme _textTheme({
    required Color bodyColor,
    required Color secondaryColor,
  }) {
    // Body copy is Inter; the display slots are overridden to Archivo below so
    // headings and figures pick up the tighter grotesque automatically.
    final base = _interTextTheme(
      TextTheme(
        bodyLarge: const TextStyle(fontWeight: FontWeight.w400, fontSize: 16, height: 1.55),
        bodyMedium: const TextStyle(fontWeight: FontWeight.w400, fontSize: 14, height: 1.55),
        bodySmall: TextStyle(
          fontWeight: FontWeight.w400,
          fontSize: 12,
          height: 1.5,
          color: secondaryColor,
        ),
        labelLarge: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
        labelMedium: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
      ),
    ).apply(bodyColor: bodyColor, displayColor: bodyColor);

    return base.copyWith(
      displaySmall: display(size: 32, color: bodyColor),
      headlineSmall: display(size: 24, color: bodyColor),
      titleLarge: display(size: 20, color: bodyColor, weight: FontWeight.w600),
      titleMedium: display(size: 16, color: bodyColor, weight: FontWeight.w600, height: 1.3),
      titleSmall: display(size: 14, color: bodyColor, weight: FontWeight.w600, height: 1.35),
      // labelSmall is the app's mono metadata slot.
      labelSmall: label(size: 11, color: secondaryColor),
    );
  }
}
