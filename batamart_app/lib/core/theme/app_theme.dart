import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_palette.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// Both themes are built by one function from an [AppPalette].
///
/// The previous version declared light and dark as two near-identical 150-line
/// blocks, which is how they drifted apart — a control fixed in one stayed
/// broken in the other. Here a change lands in both by construction, and the
/// palette itself is published as a `ThemeExtension` so individual widgets can
/// resolve the same neutrals with `context.palette`.
class AppTheme {
  AppTheme._();

  static ThemeData get light => _build(AppPalette.light, Brightness.light);
  static ThemeData get dark => _build(AppPalette.dark, Brightness.dark);

  static ThemeData _build(AppPalette p, Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: p.accent,
      brightness: brightness,
      primary: p.accent,
      surface: p.card,
      onSurface: p.ink,
      error: AppColors.danger,
    );

    final textTheme = AppTypography.textTheme(
      bodyColor: p.ink,
      secondaryColor: p.inkSecondary,
    );

    // One shared shape for every bordered surface. Near-square, hairline, no
    // shadow — structure comes from the rule, not from elevation.
    final hairlineShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      side: BorderSide(color: p.hairline),
    );

    OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: BorderSide(color: color, width: width),
        );

    // Primary actions are solid ink with a reversed label, not a coloured
    // pill — the accent is spent on one highlight per screen instead.
    final buttonLabel = AppTypography.label(size: 11, weight: FontWeight.w500);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: p.page,
      canvasColor: p.page,
      textTheme: textTheme,
      dividerColor: p.hairline,
      dividerTheme: DividerThemeData(color: p.hairline, thickness: 1, space: 1),
      extensions: <ThemeExtension<dynamic>>[p],

      appBarTheme: AppBarTheme(
        backgroundColor: p.page,
        foregroundColor: p.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: AppTypography.display(
          size: 18,
          color: p.ink,
          weight: FontWeight.w600,
          height: 1.2,
        ),
        iconTheme: IconThemeData(color: p.ink, size: 20),
      ),

      cardTheme: CardThemeData(
        color: p.card,
        elevation: 0,
        shape: hairlineShape,
        margin: EdgeInsets.zero,
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.ink,
          foregroundColor: p.card,
          disabledBackgroundColor: p.hairline,
          disabledForegroundColor: p.inkMuted,
          elevation: 0,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          textStyle: buttonLabel,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.ink,
          backgroundColor: p.card,
          minimumSize: const Size.fromHeight(52),
          side: BorderSide(color: p.hairline),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          textStyle: buttonLabel,
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.ink,
          textStyle: buttonLabel,
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.card,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md + 2,
        ),
        border: inputBorder(p.hairline),
        enabledBorder: inputBorder(p.hairline),
        focusedBorder: inputBorder(p.accent, 1.5),
        errorBorder: inputBorder(AppColors.danger),
        focusedErrorBorder: inputBorder(AppColors.danger, 1.5),
        disabledBorder: inputBorder(p.hairline),
        hintStyle: TextStyle(color: p.inkMuted),
        // The field's own label sits above it as a mono eyebrow (see
        // AppTextField), so the floating Material label is suppressed.
        floatingLabelBehavior: FloatingLabelBehavior.never,
        labelStyle: TextStyle(color: p.inkSecondary),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        // Square top corners — sheets are sheets of paper here.
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
        ),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: hairlineShape,
        titleTextStyle: AppTypography.display(
          size: 18,
          color: p.ink,
          weight: FontWeight.w600,
          height: 1.25,
        ),
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: p.inkSecondary),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: p.card,
        selectedColor: p.ink,
        side: BorderSide(color: p.hairline),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        labelStyle: AppTypography.label(size: 11, color: p.inkSecondary),
        secondaryLabelStyle: AppTypography.label(size: 11, color: p.card),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: p.slab,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: p.slabFg),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.ink,
        linearTrackColor: p.hairline,
        circularTrackColor: p.hairline,
      ),

      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.card : p.inkMuted,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.ink : p.hairline,
        ),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),

      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.card,
        indicatorColor: Colors.transparent,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => AppTypography.label(
            size: 10,
            color: states.contains(WidgetState.selected) ? p.ink : p.inkMuted,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 22,
            color: states.contains(WidgetState.selected) ? p.ink : p.inkMuted,
          ),
        ),
      ),
    );
  }
}
