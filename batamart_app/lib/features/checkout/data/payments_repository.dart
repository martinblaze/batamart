import '../../../core/api/api_client.dart';
import '../../cart/data/cart_models.dart';

class PaymentInitResult {
  const PaymentInitResult({
    required this.authorizationUrl,
    required this.reference,
    required this.deliveryFee,
    required this.totalAmount,
  });

  final String authorizationUrl;
  final String reference;
  final double deliveryFee;
  final double totalAmount;
}

/// Checkout & Payments domain (BACKEND_REFERENCE.md §3.5). Flutterwave is
/// hosted-checkout-redirect only — no direct card-charge SDK call — so
/// `initialize` just returns a URL to open in a WebView
/// (`PaymentWebViewScreen`); orders are created server-side inside
/// `GET /api/payments/verify`, which is itself an HTTP redirect chain, not
/// a JSON endpoint this client calls directly (see that screen's comment).
class PaymentsRepository {
  final _api = ApiClient.instance;

  Future<bool> isPaymentEnabled() async {
    final response = await _api.get('/api/payment-availability');
    return response['enabled'] as bool? ?? true;
  }

  /// Pays for the cart from the wallet balance. Returns the first order
  /// number. A failure carries `body['code']`: USERNAME_REQUIRED,
  /// INSUFFICIENT_BALANCE, PIN_REQUIRED, PIN_INVALID, OUT_OF_STOCK.
  Future<String> payWithWallet(List<CartItem> items, {String? pin}) async {
    final response = await _api.post(
      '/api/payments/wallet-pay',
      data: {
        'cartItems': items
            .map(
              (item) => {
                'productId': item.productId,
                'variantId': item.variantId,
                'quantity': item.quantity,
                'orderNote': item.orderNote,
                'buyerDeliveryAcknowledged': item.buyerDeliveryAcknowledged,
              },
            )
            .toList(),
        'pin': ?pin,
      },
    );
    return response['orderNumber'] as String? ?? '';
  }

  Future<PaymentInitResult> initialize(List<CartItem> items) async {
    final response = await _api.post(
      '/api/payments/initialize',
      data: {
        'cartItems': items
            .map(
              (item) => {
                'productId': item.productId,
                'variantId': item.variantId,
                'quantity': item.quantity,
                'orderNote': item.orderNote,
                'buyerDeliveryAcknowledged': item.buyerDeliveryAcknowledged,
              },
            )
            .toList(),
      },
    );
    return PaymentInitResult(
      authorizationUrl: response['authorizationUrl'] as String,
      reference:
          response['reference'] as String? ??
          response['transRef'] as String? ??
          '',
      deliveryFee: (response['deliveryFee'] as num?)?.toDouble() ?? 0,
      totalAmount: (response['totalAmount'] as num?)?.toDouble() ?? 0,
    );
  }
}
