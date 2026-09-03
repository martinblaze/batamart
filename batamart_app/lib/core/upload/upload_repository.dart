import 'dart:convert';

import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart';

/// `POST /api/upload` (BACKEND_REFERENCE.md §3.13) — a base64 data-URI
/// body, not multipart/form-data. Generic image endpoint shared by any
/// feature that uploads images (product listings, dispute evidence); the
/// caller is responsible for putting the returned URL wherever it belongs.
class UploadRepository {
  final _api = ApiClient.instance;
  final _picker = ImagePicker();

  Future<XFile?> pickImage() {
    return _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
  }

  Future<String> uploadImage(XFile file) async {
    final bytes = await file.readAsBytes();
    final mimeType = _mimeTypeFor(file.path);
    final dataUri = 'data:$mimeType;base64,${base64Encode(bytes)}';

    final response = await _api.post('/api/upload', data: {'image': dataUri});
    return response['url'] as String;
  }

  String _mimeTypeFor(String path) {
    final ext = path.toLowerCase();
    if (ext.endsWith('.png')) return 'image/png';
    if (ext.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
