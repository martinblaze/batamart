import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'promo_models.dart';

/// `GET /api/promos/home`. Never throws: promos are decoration, so any failure
/// (offline, 404 while the backend ships, bad JSON) becomes an empty payload and
/// the home screen simply shows no strips.
final promosHomeProvider = FutureProvider<PromoHome>((ref) async {
  try {
    final json = await ApiClient.instance.get('/api/promos/home');
    return PromoHome.fromJson(json);
  } catch (e) {
    debugPrint('promosHomeProvider: ignored ($e)');
    return const PromoHome();
  }
});
