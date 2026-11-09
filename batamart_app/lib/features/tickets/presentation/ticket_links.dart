import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';

/// Opens the ticket screen for a tapped push whose payload points at a
/// ticket. Returns true when it handled the tap, so the caller can skip the
/// generic notification routing.
///
/// Accepts `data['ticketId']`, or `data['url']` of the form `/tickets/<id>`,
/// `/tickets?purchase=..` or `/events/<id>` (the links the ticket
/// notifications carry). Anything else is left alone.
bool routeTicketPush(BuildContext context, Map<String, dynamic> data) {
  final ticketId = data['ticketId'];
  if (ticketId is String && ticketId.isNotEmpty) {
    context.push(AppRoutes.ticketPath(ticketId));
    return true;
  }
  final url = data['url'];
  if (url is! String || !url.startsWith('/')) return false;
  final path = Uri.tryParse(url)?.path ?? '';
  if (path == AppRoutes.myTickets ||
      path.startsWith('${AppRoutes.myTickets}/') ||
      path.startsWith('${AppRoutes.events}/')) {
    context.push(url);
    return true;
  }
  return false;
}
