import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'upload_repository.dart';

final uploadRepositoryProvider = Provider<UploadRepository>(
  (ref) => UploadRepository(),
);
