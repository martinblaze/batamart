import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

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

    isOnline.addListener(() {
      if (isOnline.value) {
        _stopReachabilityProbe();
      } else {
        _startReachabilityProbe();
      }
    });

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

  Timer? _reachabilityTimer;

  /// While offline, quietly probe the server until it answers.
  ///
  /// Without this the offline banner could never clear on its own: it is
  /// driven by request outcomes, and an app sitting on an error screen makes
  /// no requests — so a user who regained signal would keep staring at "No
  /// internet connection" until they happened to navigate somewhere. The
  /// banner's spinner promises the app is still trying; this is what makes
  /// that true.
  ///
  /// `/api/universities` is used because it needs no auth and returns a small
  /// fixed payload. Timeouts are short so a probe cannot pile up behind the
  /// interval.
  void _startReachabilityProbe() {
    if (_reachabilityTimer != null) return;
    _reachabilityTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      try {
        await _dio.get(
          '/api/universities',
          options: Options(
            receiveTimeout: const Duration(seconds: 4),
            sendTimeout: const Duration(seconds: 4),
          ),
        );
        isOnline.value = true;
      } catch (_) {
        // Still unreachable — the timer keeps running.
      }
    });
  }

  void _stopReachabilityProbe() {
    _reachabilityTimer?.cancel();
    _reachabilityTimer = null;
  }

  /// Whether the last request actually reached the server.
  ///
  /// Driven by real request outcomes rather than the OS's idea of
  /// connectivity: a phone can be firmly attached to campus Wi-Fi that has no
  /// route to the internet, which `connectivity_plus` reports as connected.
  /// Every successful response sets this true, every transport failure sets it
  /// false, so it reflects whether BataMart is reachable — the only thing the
  /// user cares about. `ConnectionBanner` listens to it.
  static final ValueNotifier<bool> isOnline = ValueNotifier<bool>(true);

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
      isOnline.value = true;
      final data = response.data;
      if (data is Map<String, dynamic>) return data;
      return {'data': data};
    } on DioException catch (e) {
      final body = e.response?.data;
      final errorField = (body is Map && body['error'] is String)
          ? body['error'] as String
          : null;

      // A response of any status means the server was reached: a 500 is a
      // server problem, not a connectivity one, and must not raise the
      // offline banner.
      final offline = e.response == null && _isTransportFailure(e);
      if (offline) {
        isOnline.value = false;
      } else if (e.response != null) {
        isOnline.value = true;
      }

      final message = errorField ??
          (offline
              ? 'No internet connection. Check your network and try again.'
              : e.message ?? 'Something went wrong. Please try again.');

      if (e.response?.statusCode == 401 &&
          (errorField == null || _sessionDeadMessages.contains(errorField))) {
        onSessionExpired?.call();
      }

      throw ApiException(
        statusCode: e.response?.statusCode,
        message: message,
        body: body is Map<String, dynamic> ? body : null,
        isNetworkError: offline,
      );
    }
  }

  /// Dio reports "never got a response" through several types; `unknown`
  /// covers the SocketException case, which is what an aeroplane-mode device
  /// actually produces.
  static bool _isTransportFailure(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return true;
      case DioExceptionType.unknown:
        return e.error is Exception;
      default:
        return false;
    }
  }
}
