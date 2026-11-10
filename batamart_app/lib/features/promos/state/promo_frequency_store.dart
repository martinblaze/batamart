import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'promo_frequency.dart';

const _boxName = 'promo_frequency_box';

/// Persists [PromoFrequencyState] in Hive (the app's existing local store).
/// Any storage failure reads as "never shown" and writes are best-effort, so
/// the promo sheet can never break the home screen.
class PromoFrequencyStore {
  Future<PromoFrequencyState> load() async {
    try {
      final box = await Hive.openBox(_boxName);
      final shown = (box.get('shown') as List?)?.whereType<int>().toList() ??
          const <int>[];
      final raw = box.get('dismissed');
      final dismissed = <String, int>{};
      if (raw is Map) {
        raw.forEach((k, v) {
          if (k is String && v is int) dismissed[k] = v;
        });
      }
      return PromoFrequencyState(shownAtMs: shown, dismissedKindsMs: dismissed);
    } catch (e) {
      debugPrint('PromoFrequencyStore.load failed ($e)');
      return const PromoFrequencyState();
    }
  }

  Future<void> save(PromoFrequencyState s) async {
    try {
      final box = await Hive.openBox(_boxName);
      await box.put('shown', s.shownAtMs);
      await box.put('dismissed', s.dismissedKindsMs);
    } catch (e) {
      debugPrint('PromoFrequencyStore.save failed ($e)');
    }
  }
}
