import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/data/auth_models.dart';
import '../../features/auth/presentation/become_seller_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/onboarding_screen.dart';
import '../../features/auth/presentation/otp_verification_screen.dart';
import '../../features/auth/presentation/profile_setup_screen.dart';
import '../../features/auth/presentation/reset_password_screen.dart';
import '../../features/auth/presentation/rider_login_screen.dart';
import '../../features/auth/presentation/signup_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/auth/presentation/suspended_screen.dart';
import '../../features/auth/state/auth_controller.dart';
import '../../features/auth/state/auth_state.dart';
import '../../features/checkout/presentation/checkout_screen.dart';
import '../../features/checkout/presentation/payment_webview_screen.dart';
import '../../features/disputes/presentation/dispute_detail_screen.dart';
import '../../features/disputes/presentation/dispute_select_order_screen.dart';
import '../../features/disputes/presentation/file_dispute_screen.dart';
import '../../features/disputes/presentation/report_screen.dart';
import '../../features/home/presentation/buyer_seller_home_shell.dart';
import '../widgets/nav/buyer_seller_nav_shell.dart';
import '../../features/home/presentation/rider_home_shell.dart';
import '../../features/kitchen_sink/presentation/kitchen_sink_screen.dart';
import '../../features/marketplace/data/product_models.dart';
import '../../features/marketplace/presentation/hot_deals_screen.dart';
import '../../features/marketplace/presentation/most_bought_screen.dart';
import '../../features/marketplace/presentation/product_detail_screen.dart';
import '../../features/marketplace/presentation/product_reviews_screen.dart';
import '../../features/marketplace/presentation/search_screen.dart';
import '../../features/marketplace/presentation/seller_catalog_screen.dart';
import '../../features/marketplace/presentation/seller_directory_screen.dart';
import '../../features/marketplace/presentation/seller_profile_screen.dart';
import '../../features/orders/presentation/order_detail_screen.dart';
import '../../features/orders/presentation/review_product_screen.dart';
import '../../features/orders/presentation/review_seller_screen.dart';
import '../../features/seller/presentation/my_shop_screen.dart';
import '../../features/seller/presentation/sales_screen.dart';
import '../../features/seller/presentation/sell_product_screen.dart';
import '../../features/seller/presentation/seller_products_list_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/referrals/presentation/referrals_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/wallet/presentation/wallet_screen.dart';
import '../../features/wallet/presentation/wallet_transactions_screen.dart';
import '../api/api_client.dart';

/// Route paths as constants so screens navigate without stringly-typed
/// duplication. Parameterized routes also get a `xPath(id)` builder for
/// constructing a concrete navigable URL.
class AppRoutes {
  AppRoutes._();

  static const splash = '/splash';
  static const suspended = '/suspended';
  static const onboarding = '/onboarding';
  static const login = '/login';
  static const signup = '/signup';
  static const verifyOtp = '/verify-otp';
  static const forgotPassword = '/forgot-password';
  static const resetPassword = '/reset-password';
  static const riderLogin = '/rider-login';
  static const profileSetup = '/profile-setup';
  static const becomeSeller = '/become-seller';
  static const home = '/home';
  static const rider = '/rider';
  static const kitchenSink = '/kitchen-sink';

  static const search = '/search';
  static const mostBought = '/most-bought';
  static const hotDeals = '/hot-deals';
  static const checkout = '/checkout';
  static const paymentWebview = '/payment-webview';
  static const productDetail = '/product/:id';
  static const productReviews = '/product/:id/reviews';
  static const sellerDirectory = '/sellers';
  static const sellerProfile = '/sellers/:id';
  static const sellerCatalog = '/sellers/:id/catalog';
  static const orderDetail = '/orders/:id';
  static const reviewProduct = '/orders/:id/review-product';
  static const reviewSeller = '/orders/:id/review-seller';
  static const myShop = '/my-shop';
  static const myShopProducts = '/my-shop/products';
  static const sellProduct = '/sell';
  static const sales = '/sales';
  static const wallet = '/wallet';
  static const walletTransactions = '/wallet/transactions';
  static const referrals = '/referrals';
  static const notifications = '/notifications';
  static const settings = '/settings';
  static const disputes = '/disputes';
  static const fileDispute = '/disputes/file/:orderId';
  static const disputeDetail = '/disputes/:id';
  static const report = '/report';

  static String productDetailPath(String id) => '/product/$id';
  static String fileDisputePath(String orderId) => '/disputes/file/$orderId';
  static String disputeDetailPath(String id) => '/disputes/$id';
  static String productReviewsPath(String id) => '/product/$id/reviews';
  static String sellerProfilePath(String id) => '/sellers/$id';
  static String sellerCatalogPath(String id) => '/sellers/$id/catalog';
  static String orderDetailPath(String id) => '/orders/$id';
  static String reviewProductPath(String id) => '/orders/$id/review-product';
  static String reviewSellerPath(String id) => '/orders/$id/review-seller';
}

/// Routes reachable while unauthenticated (besides splash itself).
const _unauthenticatedRoutes = {
  AppRoutes.onboarding,
  AppRoutes.login,
  AppRoutes.signup,
  AppRoutes.verifyOtp,
  AppRoutes.forgotPassword,
  AppRoutes.resetPassword,
  AppRoutes.riderLogin,
};

/// Product detail and its reviews are the only browsing routes backed by
/// a genuinely public endpoint (`GET /api/products/{id}`, `GET
/// /api/reviews/product` — both "Auth: none" per BACKEND_REFERENCE.md
/// §3.3/§3.8). Everything else under Marketplace (feed, search, seller
/// directory/catalog) calls endpoints that require a Bearer token +
/// `universityId` — so true guest browsing per WEB_PAGES_REFERENCE.md
/// isn't achievable against the documented API beyond these two. Flagged
/// in README "Phase 4 status".
const _guestBrowsableRoutes = {
  AppRoutes.productDetail,
  AppRoutes.productReviews,
};

/// A logged-in RIDER can only reach rider dashboard, wallet, and
/// notifications (BACKEND_REFERENCE.md §1.5) — everything else force-logs
/// out on the web. Extending the same wall here rather than only allowing
/// `AppRoutes.rider`.
const _riderAllowedExtras = {
  AppRoutes.wallet,
  AppRoutes.walletTransactions,
  AppRoutes.notifications,
  AppRoutes.settings,
};

/// Lets code with no `BuildContext` of its own (namely
/// `PushNotificationService`, which runs before the widget tree exists)
/// navigate via `rootNavigatorKey.currentContext` — needed for
/// cold-start/background push deep-linking (BUILD_PLAN Phase 11).
final rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = _AuthRefreshNotifier(ref);

  // Cross-cutting 401 handling (BUILD_PLAN Phase 11): a session-dead 401
  // from anywhere in the app forces logout, and the redirect below then
  // bounces to onboarding/login automatically via `refreshNotifier`. Set
  // here (a Provider created exactly once) rather than in a widget build.
  ApiClient.instance.onSessionExpired = () {
    ref.read(authControllerProvider.notifier).logout();
  };

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: AppRoutes.splash,
    refreshListenable: refreshNotifier,
    redirect: (context, state) =>
        _redirect(ref, state.fullPath ?? state.matchedLocation),
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.suspended,
        builder: (context, state) => const SuspendedScreen(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.signup,
        builder: (context, state) => SignupScreen(
          googleSignup: state.extra as GoogleSignupRequired?,
        ),
      ),
      GoRoute(
        path: AppRoutes.verifyOtp,
        builder: (context, state) => OtpVerificationScreen(
          email: (state.extra as Map?)?['email'] as String? ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        builder: (context, state) => ResetPasswordScreen(
          email: (state.extra as Map?)?['email'] as String? ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.riderLogin,
        builder: (context, state) => const RiderLoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.profileSetup,
        builder: (context, state) => const ProfileSetupScreen(),
      ),
      GoRoute(
        path: AppRoutes.becomeSeller,
        builder: (context, state) => const BecomeSellerScreen(),
      ),
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => BuyerSellerHomeShell(
          initialTab: state.extra as BuyerSellerNavTab?,
        ),
      ),
      GoRoute(
        path: AppRoutes.rider,
        builder: (context, state) => const RiderHomeShell(),
      ),
      GoRoute(
        path: AppRoutes.kitchenSink,
        builder: (context, state) => const KitchenSinkScreen(),
      ),
      GoRoute(
        path: AppRoutes.search,
        builder: (context, state) => const SearchScreen(),
      ),
      GoRoute(
        path: AppRoutes.hotDeals,
        builder: (context, state) => const HotDealsScreen(),
      ),
      GoRoute(
        path: AppRoutes.mostBought,
        builder: (context, state) => const MostBoughtScreen(),
      ),
      GoRoute(
        path: AppRoutes.productDetail,
        builder: (context, state) =>
            ProductDetailScreen(productId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.productReviews,
        builder: (context, state) =>
            ProductReviewsScreen(productId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.sellerDirectory,
        builder: (context, state) => const SellerDirectoryScreen(),
      ),
      GoRoute(
        path: AppRoutes.sellerProfile,
        builder: (context, state) => SellerProfileScreen(
          sellerId: state.pathParameters['id']!,
          seller: state.extra as ProductSeller?,
        ),
      ),
      GoRoute(
        path: AppRoutes.sellerCatalog,
        builder: (context, state) =>
            SellerCatalogScreen(sellerId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.checkout,
        builder: (context, state) => const CheckoutScreen(),
      ),
      GoRoute(
        path: AppRoutes.paymentWebview,
        builder: (context, state) =>
            PaymentWebViewScreen(url: (state.extra as Map)['url'] as String),
      ),
      GoRoute(
        path: AppRoutes.orderDetail,
        builder: (context, state) =>
            OrderDetailScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.reviewProduct,
        builder: (context, state) =>
            ReviewProductScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.reviewSeller,
        builder: (context, state) =>
            ReviewSellerScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.myShop,
        builder: (context, state) => const MyShopScreen(),
      ),
      GoRoute(
        path: AppRoutes.myShopProducts,
        builder: (context, state) => const SellerProductsListScreen(),
      ),
      GoRoute(
        path: AppRoutes.sellProduct,
        builder: (context, state) => const SellProductScreen(),
      ),
      GoRoute(
        path: AppRoutes.sales,
        builder: (context, state) => const SalesScreen(),
      ),
      GoRoute(
        path: AppRoutes.wallet,
        builder: (context, state) => const WalletScreen(),
      ),
      GoRoute(
        path: AppRoutes.walletTransactions,
        builder: (context, state) => const WalletTransactionsScreen(),
      ),
      GoRoute(
        path: AppRoutes.referrals,
        builder: (context, state) => const ReferralsScreen(),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.disputes,
        builder: (context, state) => const DisputeSelectOrderScreen(),
      ),
      GoRoute(
        path: AppRoutes.fileDispute,
        builder: (context, state) =>
            FileDisputeScreen(orderId: state.pathParameters['orderId']!),
      ),
      GoRoute(
        path: AppRoutes.disputeDetail,
        builder: (context, state) =>
            DisputeDetailScreen(disputeId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: AppRoutes.report,
        builder: (context, state) {
          final extra = (state.extra as Map?) ?? const {};
          return ReportScreen(
            type: extra['type'] as String? ?? 'RIDER',
            reportedUserId: extra['reportedUserId'] as String?,
            reportedOrderId: extra['reportedOrderId'] as String?,
            subjectLabel: extra['subjectLabel'] as String?,
          );
        },
      ),
    ],
  );
});

String? _redirect(Ref ref, String location) {
  // Debug-only catalog screen, exempt from every auth/role guard.
  if (location == AppRoutes.kitchenSink) return null;

  final auth = ref.read(authControllerProvider);

  if (auth.isBootstrapping) {
    return location == AppRoutes.splash ? null : AppRoutes.splash;
  }

  if (auth.status == AuthStatus.suspended) {
    return location == AppRoutes.suspended ? null : AppRoutes.suspended;
  }

  if (!auth.isAuthenticated) {
    if (_guestBrowsableRoutes.contains(location)) return null;
    if (location == AppRoutes.splash ||
        !_unauthenticatedRoutes.contains(location)) {
      return AppRoutes.onboarding;
    }
    return null;
  }

  // Authenticated from here down.
  final user = auth.user!;

  if (user.isRider) {
    if (location == AppRoutes.rider || _riderAllowedExtras.contains(location)) {
      return null;
    }
    return AppRoutes.rider;
  }

  // BUYER/SELLER: force delivery-profile completion before anything else
  // (required before checkout — BUILD_PLAN Phase 3 scope).
  if (!user.hasDeliveryProfile && location != AppRoutes.profileSetup) {
    return AppRoutes.profileSetup;
  }

  // Profile Setup only belongs here when incomplete (the branch above);
  // once `hasDeliveryProfile` flips true there's no rule elsewhere that
  // leaves it — without this, saving a complete profile from Profile Setup
  // itself just sits on the same screen forever with no error, since
  // nothing actually failed, there's just no redirect target for that
  // exact (location, now-complete-profile) combination.
  final atAuthOnlyRoute =
      location == AppRoutes.splash ||
      _unauthenticatedRoutes.contains(location) ||
      location == AppRoutes.rider ||
      (location == AppRoutes.profileSetup && user.hasDeliveryProfile);
  if (atAuthOnlyRoute) {
    return AppRoutes.home;
  }

  return null;
}

/// Bridges AuthController's Riverpod state changes to GoRouter's
/// `refreshListenable`, so a login/logout re-runs [_redirect] immediately
/// instead of waiting for the next manual navigation.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(
      authControllerProvider,
      (previous, next) => notifyListeners(),
    );
  }
}
