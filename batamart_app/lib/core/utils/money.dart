import 'package:intl/intl.dart';

/// Naira formatting, in one place.
///
/// Prices were rendered by interpolating `toStringAsFixed(0)` at 31 call
/// sites, which produces `₦78500` — no thousands separator. At a glance that
/// is hard to read (is it 78,500 or 785,000?) and it is one of the details
/// that makes an interface feel unfinished no matter how good the layout is.
/// The wallet already formatted properly; everywhere else did not.
///
/// Whole naira by default, because that is how campus prices are quoted.
/// Pass [decimals] where fractional amounts genuinely occur — wallet balances,
/// commission splits.
String naira(num value, {int decimals = 0}) {
  final pattern = decimals == 0 ? '#,##0' : '#,##0.${'0' * decimals}';
  return '₦${NumberFormat(pattern).format(value)}';
}

/// Compact form for dense surfaces — `₦78.5k`, `₦1.2m`. Use only where the
/// exact figure is available elsewhere on the screen; never for a total the
/// user is about to pay.
String nairaCompact(num value) {
  if (value.abs() >= 1000000) {
    return '₦${(value / 1000000).toStringAsFixed(1)}m';
  }
  if (value.abs() >= 1000) {
    return '₦${(value / 1000).toStringAsFixed(1)}k';
  }
  return naira(value);
}
