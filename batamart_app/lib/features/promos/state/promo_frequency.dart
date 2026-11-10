/// Pure frequency rules for the promo sheet, kept free of Flutter and storage
/// so they can be unit-tested. Persistence lives in [PromoFrequencyStore].
class PromoFrequencyState {
  const PromoFrequencyState({
    this.shownAtMs = const [],
    this.dismissedKindsMs = const {},
  });

  /// Epoch ms of each time the sheet was shown.
  final List<int> shownAtMs;

  /// kind -> epoch ms it was dismissed.
  final Map<String, int> dismissedKindsMs;
}

class PromoFrequency {
  PromoFrequency._();

  static const minGapMs = 6 * 60 * 60 * 1000;
  static const dayMs = 24 * 60 * 60 * 1000;
  static const maxPerDay = 2;
  static const kindHideMs = dayMs;
  static const maxSlides = 5;

  /// At most once per 6 hours and twice per rolling 24 hours.
  static bool canShow(PromoFrequencyState s, int nowMs) {
    final recent = s.shownAtMs.where((t) => nowMs - t < dayMs).toList();
    if (recent.length >= maxPerDay) return false;
    for (final t in s.shownAtMs) {
      if (nowMs - t < minGapMs) return false;
    }
    return true;
  }

  static bool kindHidden(PromoFrequencyState s, String kind, int nowMs) {
    final t = s.dismissedKindsMs[kind];
    return t != null && nowMs - t < kindHideMs;
  }

  /// Drops kinds dismissed within 24 h and caps the deck at [maxSlides].
  static List<T> pickSlides<T>(
    PromoFrequencyState s,
    List<T> slides,
    String Function(T) kindOf,
    int nowMs,
  ) => slides
      .where((x) => !kindHidden(s, kindOf(x), nowMs))
      .take(maxSlides)
      .toList();

  static PromoFrequencyState recordShown(PromoFrequencyState s, int nowMs) =>
      PromoFrequencyState(
        shownAtMs: [
          ...s.shownAtMs.where((t) => nowMs - t < dayMs),
          nowMs,
        ],
        dismissedKindsMs: s.dismissedKindsMs,
      );

  static PromoFrequencyState dismissKinds(
    PromoFrequencyState s,
    Iterable<String> kinds,
    int nowMs,
  ) => PromoFrequencyState(
    shownAtMs: s.shownAtMs,
    dismissedKindsMs: {
      for (final e in s.dismissedKindsMs.entries)
        if (nowMs - e.value < kindHideMs) e.key: e.value,
      for (final k in kinds) k: nowMs,
    },
  );

  /// The sheet must never cover these flows.
  static bool isBlockedPath(String path) {
    const blocked = [
      '/login',
      '/signup',
      '/verify-otp',
      '/forgot-password',
      '/reset-password',
      '/rider-login',
      '/onboarding',
      '/splash',
      '/suspended',
      '/profile-setup',
      '/checkout',
      '/payment-webview',
    ];
    return blocked.any((b) => path == b || path.startsWith('$b/'));
  }
}
