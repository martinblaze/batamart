import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/nav/buyer_seller_nav_shell.dart';
import '../../cart/state/cart_controller.dart';

/// Hosts Flutterwave's hosted-checkout page in a WebView. Chosen over a
/// third-party Flutterwave Flutter SDK (open decision flagged in
/// BUILD_PLAN_12_PHASES.md Phase 5) because the backend flow is already a
/// browser-redirect design end to end (BACKEND_REFERENCE.md §3.5):
/// `initialize` returns a `authorizationUrl` to a Flutterwave-hosted page,
/// which — after payment — redirects to `GET /api/payments/verify`, which
/// is itself **another HTTP redirect** (never JSON) to either
/// `<APP_URL>/orders?payment=success&order=<orderNumber>&count=<n>` or
/// `<APP_URL>/checkout?error=<reason>`. A generic WebView can just watch
/// for those two URL shapes; there is no JSON response at any point in
/// this chain for a native SDK to consume anyway.
class PaymentWebViewScreen extends ConsumerStatefulWidget {
  const PaymentWebViewScreen({super.key, required this.url});

  final String url;

  @override
  ConsumerState<PaymentWebViewScreen> createState() =>
      _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends ConsumerState<PaymentWebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _resolved = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _isLoading = true),
          onPageFinished: (_) => setState(() => _isLoading = false),
          onNavigationRequest: _handleNavigation,
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  NavigationDecision _handleNavigation(NavigationRequest request) {
    if (_resolved) return NavigationDecision.navigate;
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.navigate;

    if (uri.path.contains('/orders') &&
        uri.queryParameters['payment'] == 'success') {
      _resolved = true;
      final orderNumber = uri.queryParameters['order'];
      final count = uri.queryParameters['count'];
      _finish(success: true, orderNumber: orderNumber, count: count);
      return NavigationDecision.prevent;
    }

    if (uri.path.contains('/checkout') &&
        uri.queryParameters.containsKey('error')) {
      _resolved = true;
      _finish(success: false, error: uri.queryParameters['error']);
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  Future<void> _finish({
    required bool success,
    String? orderNumber,
    String? count,
    String? error,
  }) async {
    if (success) {
      await ref.read(cartControllerProvider.notifier).clear();
    }
    if (!mounted) return;

    if (success) {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text('Payment Successful 🎉'),
          content: Text(
            orderNumber != null
                ? 'Order $orderNumber placed${count != null && count != '1' ? ' ($count items)' : ''}.'
                : 'Your order has been placed.',
          ),
          actions: [
            PrimaryButton(
              label: 'Go to Orders',
              expand: false,
              onPressed: () {
                Navigator.of(context).pop();
                if (mounted) {
                  context.go(AppRoutes.home, extra: BuyerSellerNavTab.orders);
                }
              },
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment failed${error != null ? ': $error' : '.'}'),
        ),
      );
      if (mounted) context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BataAppBar(title: 'Payment', showBack: true),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
        ],
      ),
    );
  }
}
