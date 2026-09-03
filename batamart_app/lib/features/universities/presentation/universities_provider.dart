import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/universities_repository.dart';

final universitiesRepositoryProvider = Provider<UniversitiesRepository>(
  (ref) => UniversitiesRepository(),
);

final universitiesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(universitiesRepositoryProvider).fetchUniversities();
});
