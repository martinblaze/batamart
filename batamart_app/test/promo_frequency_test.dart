import 'package:batamart/features/promos/state/promo_frequency.dart';
import 'package:flutter_test/flutter_test.dart';

const _h = 60 * 60 * 1000;

void main() {
  const empty = PromoFrequencyState();

  test('shows when nothing has been shown yet', () {
    expect(PromoFrequency.canShow(empty, 1000 * _h), isTrue);
  });

  test('blocks within 6 hours of the last show', () {
    final s = PromoFrequency.recordShown(empty, 100 * _h);
    expect(PromoFrequency.canShow(s, 100 * _h + 5 * _h), isFalse);
    expect(PromoFrequency.canShow(s, 100 * _h + 6 * _h), isTrue);
  });

  test('allows at most twice in 24 hours', () {
    var s = PromoFrequency.recordShown(empty, 100 * _h);
    s = PromoFrequency.recordShown(s, 107 * _h);
    expect(PromoFrequency.canShow(s, 114 * _h), isFalse); // 2 in last 24h
    expect(PromoFrequency.canShow(s, 124 * _h), isTrue); // first aged out
  });

  test('dismissed kinds are hidden for 24h then return', () {
    final s = PromoFrequency.dismissKinds(empty, ['HOT_DEAL'], 100 * _h);
    expect(PromoFrequency.kindHidden(s, 'HOT_DEAL', 123 * _h), isTrue);
    expect(PromoFrequency.kindHidden(s, 'HOT_DEAL', 124 * _h), isFalse);
    expect(PromoFrequency.kindHidden(s, 'CART', 101 * _h), isFalse);
  });

  test('pickSlides filters dismissed kinds and caps at 5', () {
    final s = PromoFrequency.dismissKinds(empty, ['CART'], 100 * _h);
    final kinds = ['CART', 'HOT_DEAL', 'FOR_YOU', 'EVENTS', 'REFERRAL', 'WISHLIST_DROP', 'FIRST_ORDER'];
    final out = PromoFrequency.pickSlides<String>(s, kinds, (k) => k, 101 * _h);
    expect(out, ['HOT_DEAL', 'FOR_YOU', 'EVENTS', 'REFERRAL', 'WISHLIST_DROP']);
  });

  test('never over auth, checkout or payment screens', () {
    for (final p in ['/login', '/checkout', '/payment-webview', '/verify-otp']) {
      expect(PromoFrequency.isBlockedPath(p), isTrue, reason: p);
    }
    expect(PromoFrequency.isBlockedPath('/home'), isFalse);
  });
}
