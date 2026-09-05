import 'package:flutter/services.dart';

/// How much a given interaction "deserves" to be felt.
///
/// Call sites pick a weight by meaning, never a platform call directly, so the
/// whole app can be re-tuned from the table in [Haptics._resolve] instead of
/// hunting down individual `HapticFeedback.mediumImpact()` calls.
enum HapticWeight {
  /// Ambient feedback the user should barely register: a screen finishing its
  /// load, a sheet opening.
  subtle,

  /// Ordinary navigation and toggles: tab bar, switches, picking an option.
  light,

  /// A real state change the user caused: item added to or removed from the
  /// cart, an image finishing its upload.
  medium,

  /// Committing to something with money or consequence: buy, pay, withdraw.
  strong,
}

/// App-wide haptic feedback, gated on the user's Settings preferences.
///
/// Deliberately a bare singleton with static state rather than a Riverpod
/// provider, matching `core/api/api_client.dart`: haptics fire from callbacks,
/// controllers and non-widget code that has no `WidgetRef`, and threading one
/// through every call site would be far more invasive than the feature is
/// worth. [configure] keeps the static state in step with the providers in
/// `core/settings/app_settings.dart`, which own persistence.
///
/// ## Why "strength" picks a pattern rather than scaling an amplitude
///
/// Neither Flutter's `HapticFeedback` nor iOS's Taptic Engine exposes a
/// continuous intensity. iOS offers a fixed set of impact styles and Flutter
/// surfaces `selectionClick` / `light` / `medium` / `heavy` / `vibrate`. So the
/// 5–100 setting selects which of those fires for each [HapticWeight] — at the
/// low end everything collapses toward a faint selection tick, at the high end
/// everything is a heavy impact. It is a real, felt difference; it is just not
/// a linear amplitude, and pretending otherwise would mean shipping a slider
/// whose middle values did nothing.
class Haptics {
  Haptics._();

  /// The five values the Settings slider offers.
  static const List<int> strengthSteps = [5, 25, 50, 75, 100];

  static const int defaultStrength = 50;

  static bool _enabled = true;
  static int _strength = defaultStrength;

  static bool get enabled => _enabled;
  static int get strength => _strength;

  /// Mirrors the persisted preferences into the singleton. Called once at boot
  /// (before `runApp`) and again whenever the user changes either setting.
  static void configure({required bool enabled, required int strength}) {
    _enabled = enabled;
    _strength = strengthSteps.contains(strength) ? strength : defaultStrength;
  }

  // ---------------------------------------------------------------------
  // Semantic entry points. Prefer these over calling [impact] directly, so
  // intent stays readable at the call site.
  // ---------------------------------------------------------------------

  /// A screen finished loading, or a search field / sheet opened.
  static Future<void> screen() => impact(HapticWeight.subtle);

  /// Bottom-nav taps, switches, and other ordinary navigation.
  static Future<void> tap() => impact(HapticWeight.light);

  /// Choosing a category, subcategory, variant or other option in a list.
  static Future<void> selection() => impact(HapticWeight.light);

  /// A cart/inventory change, or an upload completing.
  static Future<void> change() => impact(HapticWeight.medium);

  /// Buy, pay, withdraw — anything that commits money.
  static Future<void> commit() => impact(HapticWeight.strong);

  /// Something went wrong. Distinct from [commit] only in intent today, but
  /// kept separate so error feedback can diverge later without touching call
  /// sites.
  static Future<void> error() => impact(HapticWeight.strong);

  /// Fires the platform feedback matching [weight] at the current strength.
  /// A no-op when the user has haptics switched off.
  ///
  /// Never throws: a device without a vibrator (or a platform that rejects the
  /// channel call) must not be able to break the interaction that triggered it.
  static Future<void> impact(HapticWeight weight) async {
    if (!_enabled) return;

    final pattern = _resolve(weight, _strength);
    if (pattern == null) return;

    try {
      await pattern();
    } catch (_) {
      // No vibrator, or the platform channel is unavailable. Silent by design.
    }
  }

  /// The weight × strength matrix. `null` means "stay silent at this
  /// strength" — only used for [HapticWeight.subtle] at 5, where ambient
  /// feedback on every screen load would be noise rather than signal.
  static Future<void> Function()? _resolve(HapticWeight weight, int strength) {
    switch (strength) {
      case 5:
        return switch (weight) {
          HapticWeight.subtle => null,
          HapticWeight.light => HapticFeedback.selectionClick,
          HapticWeight.medium => HapticFeedback.selectionClick,
          HapticWeight.strong => HapticFeedback.lightImpact,
        };
      case 25:
        return switch (weight) {
          HapticWeight.subtle => HapticFeedback.selectionClick,
          HapticWeight.light => HapticFeedback.selectionClick,
          HapticWeight.medium => HapticFeedback.lightImpact,
          HapticWeight.strong => HapticFeedback.mediumImpact,
        };
      case 75:
        return switch (weight) {
          HapticWeight.subtle => HapticFeedback.lightImpact,
          HapticWeight.light => HapticFeedback.mediumImpact,
          HapticWeight.medium => HapticFeedback.heavyImpact,
          HapticWeight.strong => _doubleHeavy,
        };
      case 100:
        return switch (weight) {
          HapticWeight.subtle => HapticFeedback.lightImpact,
          HapticWeight.light => HapticFeedback.heavyImpact,
          HapticWeight.medium => HapticFeedback.heavyImpact,
          HapticWeight.strong => _heavyThenVibrate,
        };
      case 50:
      default:
        return switch (weight) {
          HapticWeight.subtle => HapticFeedback.selectionClick,
          HapticWeight.light => HapticFeedback.lightImpact,
          HapticWeight.medium => HapticFeedback.mediumImpact,
          HapticWeight.strong => HapticFeedback.heavyImpact,
        };
    }
  }

  /// Two heavy impacts read as noticeably stronger than one without needing an
  /// amplitude API. The gap is short enough to feel like a single firmer event
  /// rather than two separate taps.
  static Future<void> _doubleHeavy() async {
    await HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 70));
    await HapticFeedback.heavyImpact();
  }

  /// The strongest thing available: a heavy impact followed by the platform's
  /// generic vibrate, which on Android is a longer buzz than any impact style.
  static Future<void> _heavyThenVibrate() async {
    await HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 70));
    await HapticFeedback.vibrate();
  }
}
