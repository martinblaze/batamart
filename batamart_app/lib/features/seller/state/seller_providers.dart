import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../orders/data/order_models.dart';
import '../data/seller_orders_repository.dart';
import '../data/seller_products_repository.dart';

export '../../../core/upload/upload_providers.dart'
    show uploadRepositoryProvider;

final sellerProductsRepositoryProvider = Provider<SellerProductsRepository>(
  (ref) => SellerProductsRepository(),
);

final sellerOrdersRepositoryProvider = Provider<SellerOrdersRepository>(
  (ref) => SellerOrdersRepository(),
);

final myProductsProvider = FutureProvider.autoDispose<MyProductsResult>((ref) {
  return ref.watch(sellerProductsRepositoryProvider).fetchMyProducts();
});

final salesProvider = FutureProvider.autoDispose<List<Order>>((ref) {
  return ref.watch(sellerOrdersRepositoryProvider).fetchSales();
});
