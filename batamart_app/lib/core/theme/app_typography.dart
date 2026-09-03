import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Poppins matches the rounded, bold-geometric look of the "BataMart"
/// wordmark and mockup headings. Loaded via google_fonts (cached after
/// first fetch) rather than bundling static font files.
class AppTypography {
  AppTypography._();

  static TextTheme get textTheme => _textTheme(
    bodyColor: AppColors.textPrimary,
    secondaryColor: AppColors.textSecondary,
  );

  /// Dark-mode variant — same scale/weights, inverted neutrals. Widgets
  /// that read their color from the ambient `TextTheme` (the default for
  /// any `Text` with no explicit `style.color`) get correct contrast in
  /// dark mode; widgets that hardcode `AppColors.textPrimary`/`Secondary`
  /// directly do not (see `AppTheme`'s dark-mode doc comment).
  static TextTheme get darkTextTheme => _textTheme(
    bodyColor: const Color(0xFFF3F4F6),
    secondaryColor: const Color(0xFF9CA3AF),
  );

  static TextTheme _textTheme({
    required Color bodyColor,
    required Color secondaryColor,
  }) {
    return GoogleFonts.poppinsTextTheme(
      TextTheme(
        displaySmall: const TextStyle(fontWeight: FontWeight.w700, fontSize: 32),
        headlineSmall: const TextStyle(fontWeight: FontWeight.w700, fontSize: 24),
        titleLarge: const TextStyle(fontWeight: FontWeight.w600, fontSize: 20),
        titleMedium: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        titleSmall: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        bodyLarge: const TextStyle(fontWeight: FontWeight.w400, fontSize: 16),
        bodyMedium: const TextStyle(fontWeight: FontWeight.w400, fontSize: 14),
        bodySmall: TextStyle(
          fontWeight: FontWeight.w400,
          fontSize: 12,
          color: secondaryColor,
        ),
        labelLarge: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        labelMedium: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
        labelSmall: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
      ),
    ).apply(bodyColor: bodyColor, displayColor: bodyColor);
  }
}
