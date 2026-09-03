import 'api_exception.dart';

/// Several auth routes (`login-with-password`, `google`, `riders/login`)
/// 403 with `{ error: 'Account suspended', suspended: true, reason,
/// until }` (BACKEND_REFERENCE.md §3.1/§5.9) — `e.message` alone is just
/// "Account suspended" with no detail. Appends `reason`/`until` when
/// present so the user actually knows why/for-how-long.
String formatAuthErrorMessage(ApiException e) {
  final body = e.body;
  if (body?['suspended'] != true) return e.message;

  final reason = body?['reason'] as String?;
  final until = body?['until'] as String?;
  final parts = [
    e.message,
    if (reason != null && reason.isNotEmpty) reason,
    if (until != null) 'Until: $until',
  ];
  return parts.join('\n');
}
