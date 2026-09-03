import 'package:dio/dio.dart';

import '../config/env.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

/// A 401's `error` message that unambiguously means "your session is
/// dead" — the generic messages `getUserFromRequest`-style auth checks
/// use for a missing/invalid token (e.g. `update-profile`'s documented
/// `401 { error: 'Unauthorized' }` / `401 { error: 'Invalid token' }`,
/// BACKEND_REFERENCE.md §3.1). Deliberately narrow: several routes 401
/// for business reasons that are NOT a dead session (wrong password on
/// login, wrong withdrawal PIN) — force-logging out on those would be a
/// real bug (the user just typed something wrong, they're still logged
/// in). Only these two exact messages, or a 401 with no error body at
/// all, trigger [ApiClient.onSessionExpired].
const _sessionDeadMessages = {'Unauthorized', 'Invalid token'};

/// Single Dio instance for every backend call. Attaches the bearer token
/// on every request and normalizes errors to [ApiException] using the
/// backend's `{ error: string }` shape (BACKEND_REFERENCE.md §1.2, "Error
/// shapes generally follow `{ error: string }`").
class ApiClient {
  ApiClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await TokenStorage.instance.readToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._internal();

  late final Dio _dio;

  /// Set once at app start (see `main.dart`) to force a logout + redirect
  /// to login when a request 401s with a session-dead signal (see
  /// [_sessionDeadMessages]). Deliberately a plain callback rather than a
  /// Riverpod dependency — `ApiClient` is a bare singleton with no
  /// `WidgetRef`/`ProviderContainer` of its own.
  void Function()? onSessionExpired;

  /// Exposed for callers (e.g. file upload) that need direct Dio access.
  Dio get dio => _dio;

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) {
    return _request(() => _dio.get(path, queryParameters: queryParameters));
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Object? data,
    Map<String, dynamic>? headers,
  }) {
    return _request(
      () => _dio.post(path, data: data, options: _optionsFor(headers)),
    );
  }

  Future<Map<String, dynamic>> put(String path, {Object? data}) {
    return _request(() => _dio.put(path, data: data));
  }

  Future<Map<String, dynamic>> patch(String path, {Object? data}) {
    return _request(() => _dio.patch(path, data: data));
  }

  Future<Map<String, dynamic>> delete(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
  }) {
    return _request(
      () => _dio.delete(path, data: data, queryParameters: queryParameters),
    );
  }

  Options? _optionsFor(Map<String, dynamic>? headers) {
    if (headers == null || headers.isEmpty) return null;
    return Options(headers: headers);
  }

  Future<Map<String, dynamic>> _request(
    Future<Response<dynamic>> Function() call,
  ) async {
    try {
      final response = await call();
      final data = response.data;
      if (data is Map<String, dynamic>) return data;
      return {'data': data};
    } on DioException catch (e) {
      final body = e.response?.data;
      final errorField = (body is Map && body['error'] is String)
          ? body['error'] as String
          : null;
      final message = errorField ?? e.message ?? 'Network error';

      if (e.response?.statusCode == 401 &&
          (errorField == null || _sessionDeadMessages.contains(errorField))) {
        onSessionExpired?.call();
      }

      throw ApiException(
        statusCode: e.response?.statusCode,
        message: message,
        body: body is Map<String, dynamic> ? body : null,
      );
    }
  }
}
