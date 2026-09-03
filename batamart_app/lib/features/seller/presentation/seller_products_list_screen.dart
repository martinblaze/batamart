import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../marketplace/data/product_models.dart';
import '../state/seller_providers.dart';

/// WEB_PAGES_REFERENCE.md's "My Shop" per-product actions: View, Pause/
/// Activate, Restock, Delete (`GET /api/products/my-products`,
/// `PUT`/`DELETE`/`restock` — BACKEND_REFERENCE.md §3.3).
class SellerProductsListScreen extends ConsumerWidget {
  const SellerProductsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(myProductsProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'All Products', showBack: true),
      body: productsAsync.when(
        data: (result) {
          if (result.products.isEmpty) {
            return const EmptyState(
              title: 'No products yet',
              message: 'Add your first product to start selling.',
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(myProductsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: result.products.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, index) =>
                  _ProductRow(product: result.products[index]),
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load your products.\n$error',
          onRetry: () => ref.invalidate(myProductsProvider),
        ),
      ),
    );
  }
}

class _ProductRow extends ConsumerWidget {
  const _ProductRow({required this.product});

  final Product product;

  Future<void> _restock(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    await AppBottomSheet.show(
      context: context,
      title: 'Restock ${product.name}',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppTextField(
            controller: controller,
            label: 'Quantity to add',
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: () async {
              final qty = int.tryParse(controller.text.trim());
              if (qty == null || qty <= 0) return;
              try {
                await ref
                    .read(sellerProductsRepositoryProvider)
                    .restock(product.id, qty);
                ref.invalidate(myProductsProvider);
                if (context.mounted) Navigator.of(context).pop();
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text('$e')));
                }
              }
            },
            child: const Text('Restock'),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleActive(WidgetRef ref, BuildContext context) async {
    try {
      await ref
          .read(sellerProductsRepositoryProvider)
          .setActive(product.id, !product.isActive);
      ref.invalidate(myProductsProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this product?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(sellerProductsRepositoryProvider)
          .deleteProduct(product.id);
      ref.invalidate(myProductsProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: AppNetworkImage(product.thumbnail, width: 48, height: 48),
      ),
      title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        !product.isActive
            ? 'Paused'
            : product.isOutOfStock
            ? 'Out of stock'
            : 'Qty: ${product.quantity} • ₦${product.price.toStringAsFixed(0)}',
        style: TextStyle(
          color: !product.isActive || product.isOutOfStock
              ? AppColors.danger
              : AppColors.textSecondary,
        ),
      ),
      onTap: () => context.push(AppRoutes.productDetailPath(product.id)),
      trailing: PopupMenuButton<String>(
        onSelected: (value) {
          switch (value) {
            case 'view':
              context.push(AppRoutes.productDetailPath(product.id));
            case 'toggle':
              _toggleActive(ref, context);
            case 'restock':
              _restock(context, ref);
            case 'delete':
              _delete(context, ref);
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'view', child: Text('View')),
          PopupMenuItem(
            value: 'toggle',
            child: Text(product.isActive ? 'Pause' : 'Activate'),
          ),
          const PopupMenuItem(value: 'restock', child: Text('Restock')),
          const PopupMenuItem(
            value: 'delete',
            child: Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
        icon: const Icon(LucideIcons.moreVertical),
      ),
    );
  }
}
