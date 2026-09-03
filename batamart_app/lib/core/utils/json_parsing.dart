/// Prisma's `Decimal` type (used for `User.pendingBalance`/
/// `availableBalance`) serializes to a JSON **string** unless a route
/// explicitly wraps it in `Number(...)` server-side. `/api/auth/me` and
/// `/api/riders/login` don't do that conversion (unlike `/api/wallet`,
/// which does) — a plain `as num?` cast throws `type 'String' is not a
/// subtype of type 'num?'` on their responses. Use this instead of a raw
/// cast anywhere a balance/amount field might come from either shape.
double parseBalance(dynamic value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}
