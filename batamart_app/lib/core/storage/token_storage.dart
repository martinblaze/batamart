import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wraps [flutter_secure_storage] for the JWT bearer token.
/// BACKEND_REFERENCE.md §1.2: the token is returned in the login/signup
/// response body, never set as a cookie for Bearer clients.
class TokenStorage {
  TokenStorage._();
  static final TokenStorage instance = TokenStorage._();

  static const _tokenKey = 'auth_token';

  final _storage = const FlutterSecureStorage(aOptions: AndroidOptions());

  Future<void> saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
