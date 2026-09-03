import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../data/notification_models.dart';

const _orderTypes = {
  'ORDER_PLACED',
  'ORDER_PROCESSING',
  'RIDER_ASSIGNED',
  'ORDER_PICKED_UP',
  'ORDER_ON_THE_WAY',
  'ORDER_DELIVERED',
  'ORDER_COMPLETED',
  'ORDER_DISPUTED',
  'ORDER_CANCELLED',
  'PRODUCT_REVIEWED',
  'SELLER_REVIEWED',
  'RIDER_REVIEWED',
  'OVERSIZED_DECLINED',
  'OVERSIZED_REFUND_ISSUED',
};

const _productTypes = {'STOCK_ALERT', 'PRODUCT_UNDER_REVIEW'};
const _walletTypes = {'WITHDRAWAL_PROCESSED', 'PAYMENT_RECEIVED'};

const _disputeTypes = {'DISPUTE_OPENED', 'DISPUTE_MESSAGE', 'DISPUTE_RESOLVED'};

/// Routes a tapped notification to the correct screen per its `type`
/// (BACKEND_REFERENCE.md §3.10's 27 `NotificationType` values). Report
/// notifications and account-status ones (penalty/suspension/strike) fall
/// back to Disputes or Home respectively — no dedicated report-detail or
/// account-status screen exists yet.
void routeNotification(BuildContext context, AppNotification notification) {
  final type = notification.type;

  if (_orderTypes.contains(type) && notification.orderId != null) {
    context.push(AppRoutes.orderDetailPath(notification.orderId!));
    return;
  }
  if (_productTypes.contains(type) && notification.productId != null) {
    context.push(AppRoutes.productDetailPath(notification.productId!));
    return;
  }
  if (_walletTypes.contains(type) || type == 'REFERRAL_REWARD') {
    context.push(
      type == 'REFERRAL_REWARD' ? AppRoutes.referrals : AppRoutes.wallet,
    );
    return;
  }
  if (type == 'CAMPAIGN_ANNOUNCEMENT') {
    context.go(AppRoutes.home);
    return;
  }
  if (_disputeTypes.contains(type)) {
    if (notification.disputeId != null) {
      context.push(AppRoutes.disputeDetailPath(notification.disputeId!));
    } else {
      context.push(AppRoutes.disputes);
    }
    return;
  }
  if (const {'REPORT_SUBMITTED', 'REPORT_RESOLVED'}.contains(type)) {
    // No report-detail screen exists (§3.9's GET /api/reports has no
    // per-report detail route either) — Disputes is the closest landing
    // spot for a report-related notification.
    context.push(AppRoutes.disputes);
    return;
  }
  if (const {
    'PENALTY_ISSUED',
    'ACCOUNT_SUSPENDED',
    'ACCOUNT_UNSUSPENDED',
    'SELLER_STRIKE_ISSUED',
  }.contains(type)) {
    context.go(AppRoutes.home);
    return;
  }
  // Unknown/unhandled type — no-op rather than a dead navigation.
}
