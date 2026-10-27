import 'package:intl/intl.dart';

/// "Wednesday, 5 Nov" or "Wednesday, 5 Nov and Saturday, 8 Nov" for a cart
/// whose vendors are ready on different delivery days.
String formatDeliveryDays(List<DateTime> days) {
  if (days.isEmpty) return '';
  final fmt = DateFormat('EEEE, d MMM');
  return days.map((d) => fmt.format(d.toLocal())).join(' and ');
}
