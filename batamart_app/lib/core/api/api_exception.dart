/// Thrown by [ApiClient] for any non-2xx response or transport failure.
/// `message` prefers the backend's `{ error: string }` body per
/// BACKEND_REFERENCE.md's documented error shape.
class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final Map<String, dynamic>? body;

  ApiException({required this.message, this.statusCode, this.body});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
