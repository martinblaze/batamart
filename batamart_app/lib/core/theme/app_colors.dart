import 'package:flutter/material.dart';

/// Palette sampled/derived from `docs/mockups/collage_v1.png` and the brand
/// logo files. Brand blue is a gradient (sampled directly from the bag-icon
/// logo: deep indigo-blue -> bright azure), not a single flat color — use
/// [AppColors.brandGradient] wherever the mockups show the gradient button/
/// header treatment, and [primary] for solid contexts (links, active tab
/// text, icons).
class AppColors {
  AppColors._();

  // Brand gradient (sampled from docs/mockups/BATAMART-LOGO.png)
  static const brandBlueDark = Color(0xFF1764D9);
  static const brandBlueLight = Color(0xFF2296FE);

  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [brandBlueDark, brandBlueLight],
  );

  static const primary = Color(0xFF1E88F5);
  static const primaryDark = brandBlueDark;

  /// "Girlfriend's Day"-style campaign banner rose/pink (sampled from
  /// collage_v1.png's marketplace-home frame).
  static const campaignPink = Color(0xFFEA6178);

  // Neutrals
  static const background = Color(0xFFF7F8FA);
  static const surface = Colors.white;
  static const border = Color(0xFFE5E7EB);
  static const textPrimary = Color(0xFF16181D);
  static const textSecondary = Color(0xFF6B7280);
  static const textDisabled = Color(0xFFB0B4BC);

  // Semantic
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEF4444);
  static const info = Color(0xFF3B82F6);
  static const star = Color(0xFFFBBF24);

  // Trust levels (User.trustLevel enum — BACKEND_REFERENCE.md §2)
  static const trustBronze = Color(0xFFCD7F32);
  static const trustSilver = Color(0xFF9CA3AF);
  static const trustGold = Color(0xFFF59E0B);
  static const trustVerified = primary;

  /// Order.status (OrderStatus enum — BACKEND_REFERENCE.md §2) mapped to a
  /// display color. SHIPPED/DISPUTED are in the enum but unreachable via
  /// the real transition routes (see BACKEND_REFERENCE.md §5.7) — still
  /// mapped here so a stray value never renders unstyled.
  static Color orderStatus(String status) {
    switch (status) {
      case 'PENDING':
        return warning;
      case 'PROCESSING':
      case 'SHIPPED':
      case 'RIDER_ASSIGNED':
        return info;
      case 'PICKED_UP':
      case 'ON_THE_WAY':
        return warning;
      case 'DELIVERED':
      case 'COMPLETED':
        return success;
      case 'DISPUTED':
        return danger;
      case 'CANCELLED':
        return textSecondary;
      default:
        return textSecondary;
    }
  }

  static Color trustLevel(String level) {
    switch (level) {
      case 'BRONZE':
        return trustBronze;
      case 'SILVER':
        return trustSilver;
      case 'GOLD':
        return trustGold;
      case 'VERIFIED':
        return trustVerified;
      default:
        return trustBronze;
    }
  }
}
