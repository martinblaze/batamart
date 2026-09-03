import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/campaign_badge.dart';
import '../../../core/widgets/badges/trust_badge.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../../cart/state/cart_controller.dart';
import '../data/product_models.dart';
import '../state/products_providers.dart';

/// Matches the collage's "Product Detail" frame (Canvas Sneakers), extended
/// with the richer gallery/variant behavior confirmed against the web app's
/// `app/(marketplace)/product/[id]/page.tsx`: a swipeable multi-image
/// gallery with thumbnails + dots, per-attribute variant selectors with
/// cross-dimension availability filtering, a quantity stepper, and an
/// enriched seller card. `GET /api/products/{id}` is public
/// (BACKEND_REFERENCE.md §3.3) so this screen works for guests; Add to
/// Cart/Buy Now/Report all prompt login first if logged out. "Buy Now"
/// adds to the shared cart then jumps straight to Checkout — there's no
/// separate express-checkout path, so an existing cart also comes along.
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  final Map<String, String> _selectedAttributes = {};
  final _noteController = TextEditingController();
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    // Fire-and-forget view telemetry (BACKEND_REFERENCE.md §3.3 — call the
    // dedicated /view route, don't rely on the GET's cruder side effect).
    Future.microtask(
      () => ref.read(productsRepositoryProvider).recordView(widget.productId),
    );
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  bool get _isLoggedIn => ref.read(authControllerProvider).isAuthenticated;

  void _requireLoginThen(VoidCallback action) {
    if (_isLoggedIn) {
      action();
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Log in to continue.')));
    context.push(AppRoutes.login);
  }

  Future<void> _doAddToCart(ProductVariant? variant) async {
    final notifier = ref.read(cartControllerProvider.notifier);
    await notifier.addItem(
      productId: widget.productId,
      variantId: variant?.id,
      quantity: _quantity,
    );
    final note = _noteController.text.trim();
    if (note.isEmpty) return;
    final items = ref.read(cartControllerProvider);
    final index = items.indexWhere(
      (item) => item.productId == widget.productId && item.variantId == variant?.id,
    );
    if (index != -1) await notifier.updateOrderNote(index, note);
  }

  void _addToCart(ProductVariant? variant, bool variantRequired) =>
      _requireLoginThen(() async {
        if (variantRequired && variant == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Select all options first.')),
          );
          return;
        }
        try {
          await _doAddToCart(variant);
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(const SnackBar(content: Text('Added to cart.')));
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text('$e')));
          }
        }
      });

  void _buyNow(ProductVariant? variant, bool variantRequired) =>
      _requireLoginThen(() async {
        if (variantRequired && variant == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Select all options first.')),
          );
          return;
        }
        try {
          await _doAddToCart(variant);
          if (mounted) context.push(AppRoutes.checkout);
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text('$e')));
          }
        }
      });

  void _share() {
    Clipboard.setData(
      ClipboardData(text: 'https://batamart.app/product/${widget.productId}'),
    );
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Product link copied.')));
  }

  void _report() => _requireLoginThen(() {
    String reason = 'OTHER';
    AppBottomSheet.show(
      context: context,
      title: 'Report this listing',
      child: StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          const reasons = {
            'FAKE_PRODUCT': 'Fake product',
            'WRONG_DESCRIPTION': 'Wrong description',
            'POOR_QUALITY': 'Poor quality',
            'INAPPROPRIATE_CONTENT': 'Inappropriate content',
            'OTHER': 'Other',
          };
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final entry in reasons.entries)
                    ChoiceChip(
                      label: Text(entry.value),
                      selected: reason == entry.key,
                      onSelected: (_) =>
                          setSheetState(() => reason = entry.key),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              PrimaryButton(
                label: 'Submit Report',
                onPressed: () async {
                  try {
                    await ref
                        .read(productsRepositoryProvider)
                        .reportProduct(widget.productId, reason: reason);
                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Report submitted.')),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(
                        context,
                      ).showSnackBar(SnackBar(content: Text('$e')));
                    }
                  }
                },
              ),
            ],
          );
        },
      ),
    );
  });

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(productDetailProvider(widget.productId));

    return Scaffold(
      appBar: BataAppBar(
        title: '',
        showBack: true,
        actions: [
          IconButton(
            tooltip: 'Share',
            icon: const Icon(Icons.share_outlined),
            onPressed: _share,
          ),
          IconButton(
            tooltip: 'Report this listing',
            icon: const Icon(Icons.flag_outlined),
            onPressed: _report,
          ),
        ],
      ),
      body: productAsync.when(
        data: (product) => _ProductDetailBody(
          product: product,
          selectedAttributes: _selectedAttributes,
          quantity: _quantity,
          noteController: _noteController,
          onAttributeSelected: (key, value) => setState(() {
            if (value == null) {
              _selectedAttributes.remove(key);
            } else {
              _selectedAttributes[key] = value;
            }
            _quantity = 1;
          }),
          onQuantityChanged: (q) => setState(() => _quantity = q),
          onAddToCart: _addToCart,
          onBuyNow: _buyNow,
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load this product.\n$error',
          onRetry: () =>
              ref.invalidate(productDetailProvider(widget.productId)),
        ),
      ),
    );
  }
}

/// Maps `ProductVariant.combination` (a free-form `{key: value}` map, one
/// entry per option group e.g. `{"size": "42", "color": "Black"}`) into a
/// `{key: [distinct values across every variant]}` structure — one selector
/// group per attribute key, matching the web app's derivation.
Map<String, List<String>> _attributeOptions(List<ProductVariant> variants) {
  final options = <String, List<String>>{};
  for (final v in variants) {
    v.combination.forEach((key, value) {
      final list = options.putIfAbsent(key, () => []);
      final str = value.toString();
      if (!list.contains(str)) list.add(str);
    });
  }
  return options;
}

/// The single variant whose combination matches every currently-selected
/// attribute — null if the selection is incomplete or matches nothing.
ProductVariant? _matchedVariant(
  List<ProductVariant> variants,
  Map<String, String> effectiveSelected,
  Map<String, List<String>> attributeOptions,
) {
  if (effectiveSelected.length != attributeOptions.length) return null;
  for (final v in variants) {
    final matches = effectiveSelected.entries.every(
      (e) => v.combination[e.key]?.toString() == e.value,
    );
    if (matches) return v;
  }
  return null;
}

/// Cross-dimension availability: a chip for `key=value` is enabled only if
/// some variant combining that value with the *other* already-selected
/// dimensions still has stock — mirrors the web's `isOptionAvailable`.
bool _isOptionAvailable(
  String key,
  String value,
  Map<String, String> effectiveSelected,
  List<ProductVariant> variants,
) {
  for (final v in variants) {
    if (v.combination[key]?.toString() != value) continue;
    final matchesOthers = effectiveSelected.entries
        .where((e) => e.key != key)
        .every((e) => v.combination[e.key]?.toString() == e.value);
    if (matchesOthers && v.stock > 0) return true;
  }
  return false;
}

class _ProductDetailBody extends ConsumerStatefulWidget {
  const _ProductDetailBody({
    required this.product,
    required this.selectedAttributes,
    required this.quantity,
    required this.noteController,
    required this.onAttributeSelected,
    required this.onQuantityChanged,
    required this.onAddToCart,
    required this.onBuyNow,
  });

  final Product product;
  final Map<String, String> selectedAttributes;
  final int quantity;
  final TextEditingController noteController;
  final void Function(String key, String? value) onAttributeSelected;
  final ValueChanged<int> onQuantityChanged;
  final void Function(ProductVariant? variant, bool variantRequired)
  onAddToCart;
  final void Function(ProductVariant? variant, bool variantRequired) onBuyNow;

  @override
  ConsumerState<_ProductDetailBody> createState() =>
      _ProductDetailBodyState();
}

class _ProductDetailBodyState extends ConsumerState<_ProductDetailBody> {
  late final _pageController = PageController();
  int _activeImage = 0;
  bool _descriptionExpanded = false;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final attributeOptions = _attributeOptions(product.variants);

    // Attributes with exactly one possible value are auto-selected (shown
    // as plain text rather than a chip) without needing a tap.
    final effectiveSelected = {...widget.selectedAttributes};
    for (final entry in attributeOptions.entries) {
      if (entry.value.length == 1) effectiveSelected[entry.key] = entry.value.first;
    }

    final matchedVariant = _matchedVariant(
      product.variants,
      effectiveSelected,
      attributeOptions,
    );
    final variantRequired = attributeOptions.isNotEmpty;
    final displayPrice = matchedVariant?.price ?? product.price;
    final stockKnown = attributeOptions.isEmpty || matchedVariant != null;
    final effectiveStock = matchedVariant?.stock ?? product.quantity;
    final relatedAsync = ref.watch(relatedProductsProvider(product.id));

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        _Gallery(
          images: product.images,
          activeIndex: _activeImage,
          controller: _pageController,
          quantity: product.quantity,
          onPageChanged: (i) => setState(() => _activeImage = i),
          onThumbnailTap: (i) {
            setState(() => _activeImage = i);
            _pageController.animateToPage(
              i,
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
            );
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            if (product.campaignTag != null) ...[
              CampaignBadge(tag: product.campaignTag!),
              const SizedBox(width: AppSpacing.sm),
            ],
            if (product.category != null)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Text(
                  product.category!,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          product.name,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        RatingStars(
          rating: product.avgRating,
          reviewCount: product.totalReviews,
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              '₦${displayPrice.toStringAsFixed(0)}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
            ),
            if (product.marketPrice != null &&
                product.marketPrice! > displayPrice) ...[
              const SizedBox(width: AppSpacing.sm),
              Text(
                '₦${product.marketPrice!.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
            ],
          ],
        ),
        if (variantRequired && matchedVariant == null) ...[
          const SizedBox(height: 2),
          Text(
            'Range: ₦${_minPrice(product.variants).toStringAsFixed(0)} – ₦${_maxPrice(product.variants).toStringAsFixed(0)}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
        ],
        if (stockKnown) ...[
          const SizedBox(height: 4),
          Text(
            effectiveStock <= 0
                ? 'Out of stock'
                : effectiveStock <= 3
                ? 'Only $effectiveStock left'
                : 'In stock',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: effectiveStock <= 0
                  ? AppColors.danger
                  : effectiveStock <= 3
                  ? AppColors.warning
                  : AppColors.success,
            ),
          ),
        ],
        for (final entry in attributeOptions.entries) ...[
          if (entry.value.length > 1) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              _attributeLabel(entry.key),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: entry.value.map((value) {
                final isSelected = effectiveSelected[entry.key] == value;
                final isAvailable = _isOptionAvailable(
                  entry.key,
                  value,
                  effectiveSelected,
                  product.variants,
                );
                return ChoiceChip(
                  label: Text(
                    value,
                    style: isAvailable
                        ? null
                        : const TextStyle(
                            decoration: TextDecoration.lineThrough,
                          ),
                  ),
                  selected: isSelected,
                  onSelected: isAvailable
                      ? (selected) => widget.onAttributeSelected(
                          entry.key,
                          selected ? value : null,
                        )
                      : null,
                );
              }).toList(),
            ),
          ],
        ],
        const SizedBox(height: AppSpacing.lg),
        Text(
          'Quantity',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        _QuantityStepper(
          quantity: widget.quantity,
          maxQuantity: stockKnown && effectiveStock > 0 ? effectiveStock : 1,
          onChanged: widget.onQuantityChanged,
        ),
        const SizedBox(height: AppSpacing.lg),
        const Text('Description', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        _DescriptionText(
          text: product.description?.isNotEmpty == true
              ? product.description!
              : 'No description provided.',
          expanded: _descriptionExpanded,
          onToggle: () =>
              setState(() => _descriptionExpanded = !_descriptionExpanded),
        ),
        const SizedBox(height: AppSpacing.lg),
        _DeliveryInfoBlock(deliveryEstimate: product.deliveryEstimate),
        const SizedBox(height: AppSpacing.lg),
        _NoteToSellerField(
          controller: widget.noteController,
          suggestion: effectiveSelected.values.isEmpty
              ? null
              : 'Make sure it\'s ${effectiveSelected.values.join(', ')}',
        ),
        const SizedBox(height: AppSpacing.lg),
        if (product.seller != null) _SellerCard(seller: product.seller!),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: 'Add to Cart',
                onPressed: () =>
                    widget.onAddToCart(matchedVariant, variantRequired),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: PrimaryButton(
                label: 'Buy Now',
                onPressed: () =>
                    widget.onBuyNow(matchedVariant, variantRequired),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton(
          onPressed: () =>
              context.push(AppRoutes.productReviewsPath(product.id)),
          child: Text('See all ${product.totalReviews} reviews'),
        ),
        const SizedBox(height: AppSpacing.xl),
        relatedAsync.when(
          data: (sections) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final section in sections) _RelatedSection(section: section),
            ],
          ),
          loading: () => const SizedBox.shrink(),
          error: (error, stackTrace) => const SizedBox.shrink(),
        ),
      ],
    );
  }

  static double _minPrice(List<ProductVariant> variants) =>
      variants.map((v) => v.price).reduce((a, b) => a < b ? a : b);
  static double _maxPrice(List<ProductVariant> variants) =>
      variants.map((v) => v.price).reduce((a, b) => a > b ? a : b);

  static String _attributeLabel(String key) =>
      key.isEmpty ? key : '${key[0].toUpperCase()}${key.substring(1)}';
}

class _Gallery extends StatelessWidget {
  const _Gallery({
    required this.images,
    required this.activeIndex,
    required this.controller,
    required this.quantity,
    required this.onPageChanged,
    required this.onThumbnailTap,
  });

  final List<String> images;
  final int activeIndex;
  final PageController controller;
  final int quantity;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<int> onThumbnailTap;

  @override
  Widget build(BuildContext context) {
    final displayImages = images.isEmpty ? [''] : images;

    return Column(
      children: [
        AspectRatio(
          aspectRatio: 1,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.lg),
            child: Stack(
              children: [
                PageView.builder(
                  controller: controller,
                  onPageChanged: onPageChanged,
                  itemCount: displayImages.length,
                  itemBuilder: (context, index) =>
                      AppNetworkImage(displayImages[index]),
                ),
                if (quantity <= 0)
                  const Positioned(
                    top: AppSpacing.sm,
                    left: AppSpacing.sm,
                    child: _GalleryBadge(
                      label: 'Out of stock',
                      color: AppColors.danger,
                    ),
                  )
                else if (quantity <= 3)
                  Positioned(
                    top: AppSpacing.sm,
                    left: AppSpacing.sm,
                    child: _GalleryBadge(
                      label: '$quantity left',
                      color: AppColors.warning,
                    ),
                  ),
                if (displayImages.length > 1)
                  Positioned(
                    bottom: AppSpacing.sm,
                    left: 0,
                    right: 0,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        for (var i = 0; i < displayImages.length; i++)
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            width: i == activeIndex ? 16 : 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: i == activeIndex
                                  ? Colors.white
                                  : Colors.white.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (displayImages.length > 1) ...[
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 60,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: displayImages.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) {
                final isActive = index == activeIndex;
                return GestureDetector(
                  onTap: () => onThumbnailTap(index),
                  child: Container(
                    width: 60,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                      border: Border.all(
                        color: isActive ? AppColors.primary : AppColors.border,
                        width: isActive ? 2 : 1,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: AppNetworkImage(displayImages[index]),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _GalleryBadge extends StatelessWidget {
  const _GalleryBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Static trio of rider-delivery / estimate / buyer-guarantee lines,
/// confirmed present on the web app's product detail page but missing here
/// — `product.deliveryEstimate` already existed on the model, just unused
/// by this screen until now.
class _DeliveryInfoBlock extends StatelessWidget {
  const _DeliveryInfoBlock({required this.deliveryEstimate});

  final String? deliveryEstimate;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DeliveryInfoRow(
            icon: LucideIcons.bike,
            text: 'Campus delivery available via BataMart riders',
          ),
          const SizedBox(height: AppSpacing.sm),
          _DeliveryInfoRow(
            icon: LucideIcons.clock,
            text: deliveryEstimate?.isNotEmpty == true
                ? 'Estimated delivery: $deliveryEstimate'
                : 'Estimated delivery: within a few days',
          ),
          const SizedBox(height: AppSpacing.sm),
          const _DeliveryInfoRow(
            icon: LucideIcons.messageCircle,
            text: 'Contact the seller to arrange pickup or delivery details',
          ),
          const SizedBox(height: AppSpacing.sm),
          const _DeliveryInfoRow(
            icon: LucideIcons.shieldCheck,
            text: 'Protected by BataMart buyer guarantee',
          ),
        ],
      ),
    );
  }
}

class _DeliveryInfoRow extends StatelessWidget {
  const _DeliveryInfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.primary),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }
}

/// Optional note passed through to the cart item's `orderNote`
/// (`CartController.updateOrderNote`) — carried into checkout. The
/// suggestion chip tap-fills from whatever variant options are currently
/// selected, mirroring the web app's behavior.
class _NoteToSellerField extends StatelessWidget {
  const _NoteToSellerField({required this.controller, required this.suggestion});

  final TextEditingController controller;
  final String? suggestion;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Note to seller (optional)',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: controller,
          maxLength: 300,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: suggestion ?? 'Leave a note for the seller...',
          ),
        ),
        if (suggestion != null)
          Align(
            alignment: Alignment.centerLeft,
            child: ActionChip(
              label: Text(suggestion!, overflow: TextOverflow.ellipsis),
              onPressed: () => controller.text = suggestion!,
            ),
          ),
      ],
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.maxQuantity,
    required this.onChanged,
  });

  final int quantity;
  final int maxQuantity;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _StepperButton(
          icon: Icons.remove,
          onTap: quantity > 1 ? () => onChanged(quantity - 1) : null,
        ),
        Container(
          width: 44,
          alignment: Alignment.center,
          child: Text(
            '$quantity',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
        ),
        _StepperButton(
          icon: Icons.add,
          onTap: quantity < maxQuantity ? () => onChanged(quantity + 1) : null,
        ),
      ],
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.sm),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Icon(
          icon,
          size: 18,
          color: onTap == null ? AppColors.textDisabled : AppColors.textPrimary,
        ),
      ),
    );
  }
}

class _DescriptionText extends StatelessWidget {
  const _DescriptionText({
    required this.text,
    required this.expanded,
    required this.onToggle,
  });

  final String text;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final isLong = text.length > 200;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          text,
          maxLines: expanded || !isLong ? null : 4,
          overflow: expanded || !isLong ? null : TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        if (isLong)
          TextButton(
            onPressed: onToggle,
            style: TextButton.styleFrom(padding: EdgeInsets.zero),
            child: Text(expanded ? 'Show less' : 'Read more'),
          ),
      ],
    );
  }
}

class _SellerCard extends StatelessWidget {
  const _SellerCard({required this.seller});

  final ProductSeller seller;

  @override
  Widget build(BuildContext context) {
    final initial = seller.name.isNotEmpty ? seller.name[0].toUpperCase() : '?';

    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      onTap: () => context.push(
        AppRoutes.sellerProfilePath(seller.id),
        extra: seller,
      ),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              backgroundImage: seller.profilePhoto != null
                  ? NetworkImage(seller.profilePhoto!)
                  : null,
              child: seller.profilePhoto == null
                  ? Text(
                      initial,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          seller.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(width: 6),
                      TrustBadge(level: seller.trustLevel),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      RatingStars(rating: seller.avgRating, size: 12),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        '${seller.completedOrders} orders',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  if (seller.hostelName != null) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.mapPin,
                          size: 11,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          seller.hostelName!,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              LucideIcons.chevronRight,
              size: 18,
              color: AppColors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}

class _RelatedSection extends StatelessWidget {
  const _RelatedSection({required this.section});

  final Map<String, dynamic> section;

  @override
  Widget build(BuildContext context) {
    final title = section['title']?.toString() ?? 'You may also like';
    final products = (section['products'] as List? ?? const [])
        .whereType<Map>()
        .map((p) => p.cast<String, dynamic>())
        .toList();
    if (products.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 260,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) {
                final p = products[index];
                final images = (p['images'] as List? ?? const [])
                    .cast<dynamic>();
                return SizedBox(
                  width: 150,
                  child: ProductCard(
                    imageUrl: images.isNotEmpty ? images.first.toString() : '',
                    name: p['name']?.toString() ?? '',
                    price: '₦${(p['price'] as num? ?? 0).toStringAsFixed(0)}',
                    rating: (p['avgRating'] as num?)?.toDouble(),
                    location: p['landmark']?.toString(),
                    onTap: () => context.push(
                      AppRoutes.productDetailPath(p['id'].toString()),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
