import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/chrome/app_bar.dart';

/// Flutterwave hosted page for a ticket purchase. Pops `true` when the
/// verify redirect lands on `/tickets?purchase=..&paid=1`, `false` when it
/// lands on `/events/<id>?payment=failed`, and null if the user backs out.
///
/// Shown through a plain MaterialPageRoute (not a named route) so it does not
/// touch the shared router or the shared checkout WebView.
class TicketPaymentScreen extends StatefulWidget {
  const TicketPaymentScreen({super.key, required this.url});

  final String url;

  @override
  State<TicketPaymentScreen> createState() => _TicketPaymentScreenState();
}

class _TicketPaymentScreenState extends State<TicketPaymentScreen> {
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
          onPageStarted: (_) {
            if (mounted) setState(() => _isLoading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
          onNavigationRequest: _handleNavigation,
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  NavigationDecision _handleNavigation(NavigationRequest request) {
    if (_resolved) return NavigationDecision.prevent;
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.navigate;
    final q = uri.queryParameters;

    if (uri.path == '/tickets' && q['paid'] == '1') {
      return _finish(true);
    }
    if (uri.path.startsWith('/events/') && q['payment'] == 'failed') {
      return _finish(false);
    }
    return NavigationDecision.navigate;
  }

  NavigationDecision _finish(bool ok) {
    _resolved = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).pop(ok);
    });
    return NavigationDecision.prevent;
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
