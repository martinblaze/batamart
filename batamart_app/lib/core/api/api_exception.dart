/// Thrown by [ApiClient] for any non-2xx response or transport failure.
/// `message` prefers the backend's `{ error: string }` body per
/// BACKEND_REFERENCE.md's documented error shape.
class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final Map<String, dynamic>? body;

  /// True when the request never reached the server — no connection, DNS
  /// failure, or a timeout. Callers use this to show "you are offline" rather
  /// than "the server said no", which are very different problems for a user
  /// standing on campus with one bar of signal.
  final bool isNetworkError;

  ApiException({
    required this.message,
    this.statusCode,
    this.body,
    this.isNetworkError = false,
  });

  /// Returns the bare message.
  ///
  /// Error screens across the app interpolate the caught error directly
  /// (`'Search failed.\n$error'`), so the old `ApiException(null): ...` form
  /// put a class name and a null status code in front of users on every
  /// failure.
  @override
  String toString() => message;
}
