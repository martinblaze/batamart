import 'package:flutter/material.dart';
import '../../../core/config/env.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/motion/motion.dart';
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
import '../data/product_description.dart';
import '../data/product_models.dart';
import '../state/products_providers.dart';
import '../../../core/utils/money.dart';

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
    //
    // The catch matters: this future is never awaited, so without a handler a
    // failed call (no signal, a 5xx, a timeout) becomes an unhandled async
    // error and takes the screen down. Telemetry must never cost the user the
    // page they asked for, so a failure here is silently dropped.
    Future.microtask(
      () => ref.read(productsRepositoryProvider).recordView(widget.productId),
    ).catchError((_) {});
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
          Haptics.change();
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(const SnackBar(content: Text('Added to cart.')));
          }
        } catch (e) {
          Haptics.error();
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
          Haptics.error();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Select all options first.')),
          );
          return;
        }
        try {
          Haptics.commit();
          await _doAddToCart(variant);
          if (mounted) context.push(AppRoutes.checkout);
        } catch (e) {
          Haptics.error();
          if (mounted) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text('$e')));
          }
        }
      });

  /// Opens the OS share sheet — Copy Link, Messages, WhatsApp, and whatever
  /// else the device offers — rather than silently copying to the clipboard.
  ///
  /// The URL is built from [Env.appOrigin]. It was previously hardcoded to
  /// `batamart.app`, a domain this project does not own, so every link shared
  /// from the app led nowhere.
  Future<void> _share(Product product) async {
    Haptics.tap();
    final link = '${Env.appOrigin}/product/${widget.productId}';
    try {
      await SharePlus.instance.share(
        ShareParams(
          text: '${product.name} on BataMart\n$link',
          subject: product.name,
          // Anchors the iPad popover; without it share throws there rather
          // than presenting.
          sharePositionOrigin: _shareOrigin(),
        ),
      );
    } catch (_) {
      // Some devices have no share targets at all — fall back to the old
      // behaviour rather than failing silently.
      if (!mounted) return;
      await Clipboard.setData(ClipboardData(text: link));
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Product link copied.')));
    }
  }

  /// iPad presents the share sheet as a popover and needs a source rect. The
  /// widget's own bounds are used when they can be resolved, with a small
  /// top-right box as a fallback.
  Rect? _shareOrigin() {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return null;
    return box.localToGlobal(Offset.zero) & box.size;
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

    return productAsync.when(
      data: (product) => _ProductDetailBody(
        product: product,
        selectedAttributes: _selectedAttributes,
        quantity: _quantity,
        noteController: _noteController,
        onAttributeSelected: (key, value) {
          Haptics.selection();
          setState(() {
            if (value == null) {
              _selectedAttributes.remove(key);
            } else {
              _selectedAttributes[key] = value;
            }
            _quantity = 1;
          });
        },
        onQuantityChanged: (q) {
          Haptics.selection();
          setState(() => _quantity = q);
        },
        onAddToCart: _addToCart,
        onBuyNow: _buyNow,
        onShare: () => _share(product),
        onReport: _report,
      ),
      // The loading and error states keep a conventional bar — there is no
      // photograph yet for a hero to hold.
      loading: () => const Scaffold(
        appBar: BataAppBar(title: '', showBack: true),
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stackTrace) => Scaffold(
        appBar: const BataAppBar(title: '', showBack: true),
        body: ErrorState(
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
    required this.onShare,
    required this.onReport,
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
  final VoidCallback onShare;
  final VoidCallback onReport;

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

    return Scaffold(
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          // The photograph is the page's header. Scrolling shrinks it into a
          // compact bar that picks up the product's name — so the title is
          // always available without a second, redundant heading.
          _ProductHeroBar(
            product: product,
            activeIndex: _activeImage,
            controller: _pageController,
            onPageChanged: (i) => setState(() => _activeImage = i),
            onShare: widget.onShare,
            onReport: widget.onReport,
          ),
          SliverPadding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
        if (product.images.length > 1)
          _GalleryThumbs(
            images: product.images,
            activeIndex: _activeImage,
            onThumbnailTap: (i) {
              setState(() => _activeImage = i);
              _pageController.animateToPage(
                i,
                duration: Motion.base,
                curve: Motion.ease,
              );
            },
          ),
        if (product.images.length > 1) const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            if (product.campaignTag != null) ...[
              CampaignBadge(tag: product.campaignTag!),
              const SizedBox(width: AppSpacing.sm),
            ],
            if (product.category != null)
              Text(
                product.category!.toUpperCase(),
                style: AppTypography.label(
                  size: 9,
                  color: context.palette.inkMuted,
                ),
              ),
          ],
        ).enter(index: 0),
        const SizedBox(height: AppSpacing.sm),
        Text(
          product.name,
          style: AppTypography.display(size: 25, weight: FontWeight.w700, height: 1.12),
        ).enter(index: 1),
        const SizedBox(height: AppSpacing.sm),

        // Social proof reads as one line of evidence: rating, review count,
        // and units sold together, the way a shopper actually weighs them.
        Row(
          children: [
            RatingStars(rating: product.avgRating, reviewCount: product.totalReviews),
            if (product.orderCount > 0) ...[
              const SizedBox(width: AppSpacing.sm),
              Container(width: 1, height: 11, color: context.palette.hairline),
              const SizedBox(width: AppSpacing.sm),
              Text(
                '${product.orderCount} SOLD',
                style: AppTypography.label(size: 9, color: context.palette.inkSecondary),
              ),
            ],
          ],
        ).enter(index: 2),
        const SizedBox(height: AppSpacing.lg),

        // Price sits between rules — the loudest thing on the page, with the
        // saving stated rather than left for the reader to compute.
        Container(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: context.palette.hairline),
              bottom: BorderSide(color: context.palette.hairline),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              CountUp(
                value: displayPrice,
                format: (v) => naira(v),
                style: AppTypography.figure(size: 31, color: context.palette.ink),
              ),
              if (product.marketPrice != null &&
                  product.marketPrice! > displayPrice) ...[
                const SizedBox(width: AppSpacing.md),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    naira(product.marketPrice!),
                    style: TextStyle(
                      color: context.palette.inkMuted,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    color: AppColors.danger,
                    child: Text(
                      'SAVE ${(((product.marketPrice! - displayPrice) / product.marketPrice!) * 100).round()}%',
                      style: AppTypography.label(size: 9, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ).enter(index: 3),
        if (variantRequired && matchedVariant == null) ...[
          const SizedBox(height: 2),
          Text(
            'Range: ₦${_minPrice(product.variants).toStringAsFixed(0)} – ₦${_maxPrice(product.variants).toStringAsFixed(0)}',
            style: TextStyle(color: context.palette.inkSecondary, fontSize: 12),
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
        // Older listings store `{variants, tags}` as base64 in this field
        // instead of prose. Rendering it raw showed buyers a wall of
        // "VARIANTS_V2::eyJ2YXJp..." where the description should be.
        Builder(
          builder: (context) {
            final parsed = ProductDescription.parse(product.description);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _DescriptionText(
                  text: parsed.text.isNotEmpty
                      ? parsed.text
                      : 'No description provided.',
                  expanded: _descriptionExpanded,
                  onToggle: () => setState(
                    () => _descriptionExpanded = !_descriptionExpanded,
                  ),
                ),
                // The tags recovered from the encoding are the only content
                // those listings actually carry, so they stand in for prose
                // the same way they do on the web product page.
                if (parsed.tags.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final tag in parsed.tags)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: context.palette.page,
                            borderRadius: BorderRadius.circular(AppRadii.sm),
                            border: Border.all(color: context.palette.hairline),
                          ),
                          child: Text(
                            tag,
                            style: TextStyle(
                              fontSize: 11,
                              color: context.palette.inkSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            );
          },
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
              ]),
            ),
          ),
        ],
      ),
      // The two actions stay reachable at any scroll depth. They are the same
      // two buttons that used to sit inline halfway down the page, where they
      // were only findable by scrolling past the description.
      bottomNavigationBar: _BuyBar(
        price: displayPrice,
        inStock: !stockKnown || effectiveStock > 0,
        onAddToCart: () => widget.onAddToCart(matchedVariant, variantRequired),
        onBuyNow: () => widget.onBuyNow(matchedVariant, variantRequired),
      ),
    );
  }

  static double _minPrice(List<ProductVariant> variants) =>
      variants.map((v) => v.price).reduce((a, b) => a < b ? a : b);
  static double _maxPrice(List<ProductVariant> variants) =>
      variants.map((v) => v.price).reduce((a, b) => a > b ? a : b);

  static String _attributeLabel(String key) =>
      key.isEmpty ? key : '${key[0].toUpperCase()}${key.substring(1)}';
}

/// The product photograph as the page header.
///
/// A [SliverAppBar] rather than a card in the list: scrolling shrinks the
/// image into a compact bar and fades the product's name into it, so the
/// title is always to hand without a duplicate heading in the content. That
/// collapse *is* the parallax — the image moves at a different rate from the
/// text over it, which is what reads as depth.
class _ProductHeroBar extends StatelessWidget {
  const _ProductHeroBar({
    required this.product,
    required this.activeIndex,
    required this.controller,
    required this.onPageChanged,
    required this.onShare,
    required this.onReport,
  });

  final Product product;
  final int activeIndex;
  final PageController controller;
  final ValueChanged<int> onPageChanged;
  final VoidCallback onShare;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final images = product.images.isEmpty ? [''] : product.images;
    final height =
        (MediaQuery.of(context).size.height * 0.52).clamp(320.0, 460.0);

    return SliverAppBar(
      expandedHeight: height,
      collapsedHeight: 64,
      pinned: true,
      stretch: true,
      backgroundColor: palette.page,
      surfaceTintColor: Colors.transparent,
      automaticallyImplyLeading: false,
      leading: _HeroAction(
        icon: LucideIcons.arrowLeft,
        tooltip: 'Back',
        onTap: () => Navigator.of(context).maybePop(),
      ),
      actions: [
        _HeroAction(icon: LucideIcons.share2, tooltip: 'Share', onTap: onShare),
        _HeroAction(
          icon: LucideIcons.flag,
          tooltip: 'Report this listing',
          onTap: onReport,
        ),
        const SizedBox(width: AppSpacing.sm),
      ],
      flexibleSpace: LayoutBuilder(
        builder: (context, constraints) {
          // 0 fully expanded, 1 fully collapsed.
          final t = ((height - constraints.maxHeight + 64) / (height - 64))
              .clamp(0.0, 1.0);
          return FlexibleSpaceBar(
            stretchModes: const [StretchMode.zoomBackground],
            titlePadding:
                const EdgeInsets.only(left: 64, right: 108, bottom: 20),
            title: Opacity(
              // Only appears once the photograph is mostly gone, so the two
              // never compete for the same space.
              opacity: t < 0.75 ? 0 : (t - 0.75) / 0.25,
              child: Text(
                product.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.display(size: 15, color: palette.ink),
              ),
            ),
            background: Stack(
              fit: StackFit.expand,
              children: [
                PageView.builder(
                  controller: controller,
                  onPageChanged: onPageChanged,
                  itemCount: images.length,
                  itemBuilder: (context, index) =>
                      AppNetworkImage(images[index]),
                ),
                // Fades the foot of the image into the page ground so the
                // content below reads as continuous with it.
                IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          palette.page.withValues(alpha: 0.0),
                          palette.page,
                        ],
                        stops: const [0, 0.78, 1],
                      ),
                    ),
                  ),
                ),
                if (product.quantity <= 0)
                  const Positioned(
                    top: 72,
                    left: AppSpacing.lg,
                    child: _GalleryBadge(
                      label: 'Out of stock',
                      color: AppColors.danger,
                    ),
                  )
                else if (product.quantity <= 3)
                  Positioned(
                    top: 72,
                    left: AppSpacing.lg,
                    child: _GalleryBadge(
                      label: '${product.quantity} left',
                      color: AppColors.warning,
                    ),
                  ),
                if (images.length > 1)
                  Positioned(
                    bottom: AppSpacing.xl,
                    left: 0,
                    right: 0,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        for (var i = 0; i < images.length; i++)
                          AnimatedContainer(
                            duration: Motion.fast,
                            curve: Motion.ease,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            width: i == activeIndex ? 18 : 6,
                            height: 3,
                            color: i == activeIndex
                                ? palette.ink
                                : palette.ink.withValues(alpha: 0.28),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// A hero-bar control. Sits on a photograph, so it carries its own scrim.
class _HeroAction extends StatelessWidget {
  const _HeroAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: AppSpacing.sm,
      ),
      child: Tooltip(
        message: tooltip,
        child: Pressable(
          onTap: onTap,
          scale: 0.9,
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.38),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 17),
          ),
        ),
      ),
    );
  }
}

/// Thumbnail strip. Lives in the content rather than over the hero, so the
/// photograph is never partly covered by its own navigation.
class _GalleryThumbs extends StatelessWidget {
  const _GalleryThumbs({
    required this.images,
    required this.activeIndex,
    required this.onThumbnailTap,
  });

  final List<String> images;
  final int activeIndex;
  final ValueChanged<int> onThumbnailTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return SizedBox(
      height: 62,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: images.length,
        separatorBuilder: (context, index) =>
            const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final isActive = index == activeIndex;
          return Pressable(
            onTap: () => onThumbnailTap(index),
            scale: 0.94,
            child: AnimatedContainer(
              duration: Motion.base,
              curve: Motion.ease,
              width: 62,
              decoration: BoxDecoration(
                border: Border.all(
                  color: isActive ? palette.ink : palette.hairline,
                  width: isActive ? 2 : 1,
                ),
              ),
              child: AppNetworkImage(images[index]),
            ),
          );
        },
      ),
    );
  }
}

/// Persistent buy bar. The price stays legible at any scroll depth, and the
/// two actions sit beside it.
class _BuyBar extends StatelessWidget {
  const _BuyBar({
    required this.price,
    required this.inStock,
    required this.onAddToCart,
    required this.onBuyNow,
  });

  final double price;
  final bool inStock;
  final VoidCallback onAddToCart;
  final VoidCallback onBuyNow;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      decoration: BoxDecoration(
        color: palette.card,
        border: Border(top: BorderSide(color: palette.hairline)),
      ),
      child: SafeArea(
        top: false,
        // Explicit height. As a `bottomNavigationBar` this is laid out with
        // loose constraints, and the nested Row/Expanded chain reports an
        // unbounded intrinsic height — which let the bar swallow the whole
        // viewport and squeeze the scroll body to nothing. A persistent action
        // bar wants a fixed height regardless.
        child: SizedBox(
          height: 74,
          child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.md,
          ),
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'TOTAL',
                    style: AppTypography.label(size: 9, color: palette.inkMuted),
                  ),
                  const SizedBox(height: 3),
                  // Counts up rather than appearing, so changing a variant
                  // reads as the price moving, not the label being swapped.
                  CountUp(
                    value: price,
                    duration: Motion.base,
                    format: (v) => naira(v),
                    style: AppTypography.figure(size: 20, color: palette.ink),
                  ),
                ],
              ),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: SecondaryButton(
                        label: 'Add to cart',
                        onPressed: inStock ? onAddToCart : null,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: PrimaryButton(
                        label: 'Buy now',
                        onPressed: inStock ? onBuyNow : null,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          ),
        ),
      ),
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
        color: context.palette.page,
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
            style: TextStyle(fontSize: 13, color: context.palette.inkSecondary),
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
            style: AppTypography.display(size: 16, weight: FontWeight.w700),
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
          border: Border.all(color: context.palette.hairline),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Icon(
          icon,
          size: 18,
          color: onTap == null ? context.palette.inkMuted : context.palette.ink,
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
          style: TextStyle(color: context.palette.inkSecondary),
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
          color: context.palette.page,
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
                        style: TextStyle(
                          fontSize: 11,
                          color: context.palette.inkSecondary,
                        ),
                      ),
                    ],
                  ),
                  if (seller.hostelName != null) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(
                          LucideIcons.mapPin,
                          size: 11,
                          color: context.palette.inkSecondary,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          seller.hostelName!,
                          style: TextStyle(
                            fontSize: 11,
                            color: context.palette.inkSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              LucideIcons.chevronRight,
              size: 18,
              color: context.palette.inkSecondary,
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
            style: AppTypography.display(size: 16, weight: FontWeight.w700),
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
                    price: naira((p['price'] as num? ?? 0)),
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
