import 'package:flutter/material.dart';

import 'app_palette.dart';

/// Colours that mean the same thing on either ground.
///
/// The neutrals — page, card, ink, hairline — moved to [AppPalette], because
/// they have to flip between light and dark and a `static const` can't. Read
/// those with `context.palette`. What stays here is the accent, the status
/// colours, and the trust tiers: values whose meaning is fixed regardless of
/// which theme is showing.
class AppColors {
  AppColors._();

  /// The single accent. It appears roughly once per screen — the primary
  /// action, or a live indicator. There is no brand gradient in this system:
  /// solid ink carries primary actions, and the accent is the highlight.
  static const primary = Color(0xFF1E90FF);

  /// Seasonal campaign banners only, never a general-purpose colour.
  static const campaignRose = Color(0xFFEA6178);

  // ── Status ────────────────────────────────────────────────────────────
  // Reserved for genuine state. A thing that is not a status is neutral.
  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEF4444);
  static const info = primary;
  static const star = Color(0xFFF59E0B);

  // ── Trust tiers (User.trustLevel — BACKEND_REFERENCE.md §2) ───────────
  // Neutral by default; only the top two tiers earn a colour, so a wall of
  // seller cards doesn't turn into a wall of badges competing for attention.
  static const trustBronze = Color(0xFF9A958C);
  static const trustSilver = Color(0xFF9A958C);
  static const trustGold = warning;
  static const trustVerified = primary;

  // The neutrals deliberately do NOT live here. page / card / ink / hairline
  // are on AppPalette because they have to flip between themes, and a
  // `static const` cannot. Every one of the ~150 call sites that used to read
  // them from this class now reads `context.palette` instead; re-adding an
  // alias here would quietly reintroduce light-mode colours on a dark ground.

  /// Order.status (OrderStatus enum — BACKEND_REFERENCE.md §2) mapped to a
  /// display colour. SHIPPED/DISPUTED are in the enum but unreachable via the
  /// real transition routes (see BACKEND_REFERENCE.md §5.7) — still mapped
  /// here so a stray value never renders unstyled.
  ///
  /// Pass [neutral] (usually `context.palette.inkMuted`) so a cancelled order
  /// reads correctly in dark mode.
  static Color orderStatus(String status, {Color? neutral}) {
    switch (status) {
      case 'PENDING':
        return warning;
      case 'PROCESSING':
      case 'SHIPPED':
      case 'RIDER_ASSIGNED':
        return info;
      case 'PICKED_UP':
      case 'AT_HUB':
      case 'PACKED':
      case 'ON_THE_WAY':
        return info;
      case 'DELIVERED':
      case 'COMPLETED':
        return success;
      case 'DISPUTED':
        return danger;
      case 'CANCELLED':
      default:
        return neutral ?? const Color(0xFF9A958C);
    }
  }

  static Color trustLevel(String level) {
    switch (level) {
      case 'GOLD':
        return trustGold;
      case 'VERIFIED':
        return trustVerified;
      case 'SILVER':
        return trustSilver;
      case 'BRONZE':
      default:
        return trustBronze;
    }
  }
}
