import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/widgets/nav/buyer_seller_nav_shell.dart';

/// Where a web path lands in the app. [tab] is set when the target is a tab of
/// the home shell rather than a pushed route.
class PromoTarget {
  const PromoTarget(this.path, {this.tab});
  final String path;
  final BuyerSellerNavTab? tab;
}

/// Maps a web CTA path (`/product/<id>`, `/marketplace/deals`, `/cart`, ...)
/// to an app route, or null when it is not one we know. Accepts absolute URLs
/// too and ignores query strings.
PromoTarget? resolvePromoUrl(String? url) {
  if (url == null || url.isEmpty) return null;
  final path = (Uri.tryParse(url)?.path ?? '').replaceAll(RegExp(r'/+$'), '');
  final seg = path.split('/').where((s) => s.isNotEmpty).toList();
  if (seg.isEmpty) return const PromoTarget(AppRoutes.home);

  switch (seg.first) {
    case 'product':
      if (seg.length >= 2) {
        return PromoTarget(AppRoutes.productDetailPath(seg[1]));
      }
    case 'marketplace':
      if (seg.length >= 2 && seg[1] == 'deals') {
        return const PromoTarget(AppRoutes.hotDeals);
      }
      return const PromoTarget(AppRoutes.home);
    case 'deals':
    case 'hot-deals':
      return const PromoTarget(AppRoutes.hotDeals);
    case 'recommended':
      // The "Picked for you" rail lives on the home feed.
      return const PromoTarget(AppRoutes.home);
    case 'events':
      return seg.length >= 2
          ? PromoTarget(AppRoutes.eventDetailPath(seg[1]))
          : const PromoTarget(AppRoutes.events);
    case 'tickets':
      return seg.length >= 2
          ? PromoTarget(AppRoutes.ticketPath(seg[1]))
          : const PromoTarget(AppRoutes.myTickets);
    case 'cart':
      return const PromoTarget(AppRoutes.home, tab: BuyerSellerNavTab.cart);
    case 'orders':
      return seg.length >= 2
          ? PromoTarget(AppRoutes.orderDetailPath(seg[1]))
          : const PromoTarget(AppRoutes.home, tab: BuyerSellerNavTab.orders);
    case 'referrals':
      return const PromoTarget(AppRoutes.referrals);
    case 'wishlist':
      return const PromoTarget(AppRoutes.wishlist);
    case 'most-bought':
      return const PromoTarget(AppRoutes.mostBought);
  }
  return null;
}

void _go(BuildContext context, PromoTarget t) {
  if (t.path == AppRoutes.home) {
    context.go(AppRoutes.home, extra: t.tab);
  } else {
    context.push(t.path);
  }
}

/// Opens [url] in the app, falling back to the home tab when unknown.
void openPromoUrl(BuildContext context, String? url) {
  _go(context, resolvePromoUrl(url) ?? const PromoTarget(AppRoutes.home));
}

/// Opens [url] only when it maps to a known screen. Returns whether it did, so
/// push taps can fall through to type-based routing.
bool openPromoUrlIfKnown(BuildContext context, String? url) {
  final target = resolvePromoUrl(url);
  if (target == null) return false;
  _go(context, target);
  return true;
}
