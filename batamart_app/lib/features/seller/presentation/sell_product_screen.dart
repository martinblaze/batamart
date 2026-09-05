import 'package:flutter/material.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/editorial.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/data/category_tree.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../auth/state/auth_controller.dart';
import '../state/seller_providers.dart';
import '../../../core/utils/money.dart';

class _VariantDraft {
  String label = '';
  String price = '';
  String stock = '';
}

/// Matches the collage's "Sell / Add Product" frame: a 4-step numbered
/// stepper starting with Basic Info + image slots. Steps 2-4 have no
/// supplied mockup — built to the design system (see README "Phase 7
/// status"). `POST /api/products` (BACKEND_REFERENCE.md §3.3) has no
/// server-side seller-role check, but this flow is only reachable once a
/// buyer has become a seller (client-side convention, per the doc).
///
/// Category/subcategory use the real tree mirrored in
/// `core/data/category_tree.dart` (from the web app's `CATEGORY_TREE`)
/// instead of free text, so listings actually match Search/Deals filters.
/// A confirm modal (fee math + a second explicit acknowledgment, matching
/// the web app's `ConfirmListingModal`) gates the final submit.
class SellProductScreen extends ConsumerStatefulWidget {
  const SellProductScreen({super.key});

  @override
  ConsumerState<SellProductScreen> createState() => _SellProductScreenState();
}

class _SellProductScreenState extends ConsumerState<SellProductScreen> {
  int _step = 0;

  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  ProductCategory? _selectedCategory;
  ProductCategory? _selectedSubcategory;
  final _priceController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');
  final _deliveryEstimateController = TextEditingController();
  final _hostelController = TextEditingController();
  final _roomController = TextEditingController();
  final _landmarkController = TextEditingController();
  final _weightController = TextEditingController();
  final _lengthController = TextEditingController();
  final _widthController = TextEditingController();
  final _heightController = TextEditingController();

  /// Kept in step with `MAX_LISTING_IMAGES` in `lib/listing-limits.ts`, which
  /// the web sell form and `POST /api/products` both use. Dart cannot import
  /// it, so changing one means changing the other. The API enforces this too,
  /// so exceeding it fails the listing rather than silently truncating.
  static const int _maxImages = 3;

  final List<String> _images = [];
  bool _isUploadingImage = false;
  bool _variantsEnabled = false;
  final List<_VariantDraft> _variants = [];
  String? _campaignTag;
  bool _deliveryAgreementConfirmed = false;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _hostelController.text = user?.hostelName ?? '';
    _roomController.text = user?.roomNumber ?? '';
    _landmarkController.text = user?.landmark ?? '';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    _quantityController.dispose();
    _deliveryEstimateController.dispose();
    _hostelController.dispose();
    _roomController.dispose();
    _landmarkController.dispose();
    _weightController.dispose();
    _lengthController.dispose();
    _widthController.dispose();
    _heightController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadImage() async {
    setState(() => _isUploadingImage = true);
    try {
      final repository = ref.read(uploadRepositoryProvider);
      final file = await repository.pickImage();
      if (file == null) return;
      final url = await repository.uploadImage(file);
      // The upload is the one step here with real latency, so confirming it
      // finished is the most useful haptic on this screen.
      Haptics.change();
      setState(() => _images.add(url));
    } catch (e) {
      Haptics.error();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _isUploadingImage = false);
    }
  }

  bool get _canProceedFromStep1 =>
      _nameController.text.trim().isNotEmpty && _selectedCategory != null;
  bool get _canProceedFromStep2 =>
      (double.tryParse(_priceController.text.trim()) ?? 0) > 0 &&
      (int.tryParse(_quantityController.text.trim()) ?? 0) > 0;

  void _next() {
    if (_step == 0 && !_canProceedFromStep1) {
      Haptics.error();
      setState(() => _error = 'Name and category are required.');
      return;
    }
    if (_step == 1 && !_canProceedFromStep2) {
      Haptics.error();
      setState(() => _error = 'Enter a valid price and quantity.');
      return;
    }
    Haptics.tap();
    setState(() {
      _error = null;
      _step = (_step + 1).clamp(0, 3);
    });
  }

  void _back() {
    Haptics.tap();
    if (_step == 0) {
      context.pop();
      return;
    }
    setState(() => _step -= 1);
  }

  /// "List Product" opens the confirm modal first (matching the web app's
  /// `ConfirmListingModal` — a second, explicit gate on top of the
  /// delivery-agreement checkbox from step 3) rather than submitting
  /// directly.
  void _openConfirmModal() {
    if (!_deliveryAgreementConfirmed) {
      setState(
        () => _error = 'Please confirm motorcycle delivery suitability.',
      );
      return;
    }
    final price = double.tryParse(_priceController.text.trim()) ?? 0;
    AppBottomSheet.show(
      context: context,
      title: 'Confirm Listing',
      child: _ConfirmListingContent(
        price: price,
        onConfirm: () {
          Navigator.of(context).pop();
          _actuallySubmit();
        },
      ),
    );
  }

  Future<void> _actuallySubmit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final variants = _variantsEnabled
          ? _variants
                .where((v) => v.label.isNotEmpty && v.price.isNotEmpty)
                .map(
                  (v) => {
                    'combination': {'option': v.label},
                    'price': double.tryParse(v.price) ?? 0,
                    'stock': int.tryParse(v.stock) ?? 0,
                  },
                )
                .toList()
          : null;

      final width = double.tryParse(_widthController.text.trim());
      final height = double.tryParse(_heightController.text.trim());
      final length = double.tryParse(_lengthController.text.trim());

      await ref
          .read(sellerProductsRepositoryProvider)
          .createProduct(
            name: _nameController.text.trim(),
            price: double.parse(_priceController.text.trim()),
            category: _selectedCategory!.label,
            categoryKey: _selectedCategory!.key,
            quantity: int.parse(_quantityController.text.trim()),
            description: _descriptionController.text.trim(),
            subcategory: _selectedSubcategory?.label,
            subcategoryKey: _selectedSubcategory?.key,
            images: _images,
            hostelName: _hostelController.text.trim().isEmpty
                ? null
                : _hostelController.text.trim(),
            roomNumber: _roomController.text.trim().isEmpty
                ? null
                : _roomController.text.trim(),
            landmark: _landmarkController.text.trim().isEmpty
                ? null
                : _landmarkController.text.trim(),
            deliveryEstimate: _deliveryEstimateController.text.trim().isEmpty
                ? null
                : _deliveryEstimateController.text.trim(),
            campaignTag: _campaignTag,
            variants: variants,
            estimatedWeightKg: double.tryParse(_weightController.text.trim()),
            dimensionsCm: (length != null && width != null && height != null)
                ? {'length': length, 'width': width, 'height': height}
                : null,
          );

      ref.invalidate(myProductsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Listed! Pending moderation approval before it appears live.',
            ),
          ),
        );
        context.pop();
      }
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: BataAppBar(
        title: 'Sell / Add Product',
        showBack: true,
        onBack: _back,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: _StepIndicator(step: _step),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: switch (_step) {
                  0 => _buildStep1(),
                  1 => _buildStep2(),
                  2 => _buildStep3(),
                  _ => _buildStep4(),
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                children: [
                  if (_error != null) ...[
                    Text(
                      _error!,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                  PrimaryButton(
                    label: _step == 3 ? 'List Product' : 'Next',
                    onPressed: _step == 3 ? _openConfirmModal : _next,
                    isLoading: _isSubmitting,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow('01 — Basic Info'),
        const SizedBox(height: AppSpacing.xl),
        const Text(
          'Add Product Images',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final url in _images)
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.sm),
                child: AppNetworkImage(url, width: 72, height: 72),
              ),
            if (_images.length < _maxImages)
              InkWell(
                onTap: _isUploadingImage ? null : _pickAndUploadImage,
                borderRadius: BorderRadius.circular(AppRadii.sm),
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    border: Border.all(color: context.palette.hairline),
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                  ),
                  child: _isUploadingImage
                      ? const Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          LucideIcons.plus,
                          color: context.palette.inkSecondary,
                        ),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AppTextField(
          controller: _nameController,
          label: 'Product Name',
          hint: 'Enter product name',
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          controller: _descriptionController,
          label: 'Description',
          maxLines: 4,
        ),
        const SizedBox(height: AppSpacing.md),
        const Text('Category', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: AppSpacing.sm),
        _CategoryPickerField(
          label: _selectedCategory?.label ?? 'Select a category',
          icon: _selectedCategory?.icon,
          onTap: _pickCategory,
        ),
        if (productSubcategories[_selectedCategory?.key]?.isNotEmpty ??
            false) ...[
          const SizedBox(height: AppSpacing.md),
          const Text(
            'Subcategory',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: AppSpacing.sm),
          _CategoryPickerField(
            label: _selectedSubcategory?.label ?? 'Select a subcategory (optional)',
            icon: _selectedSubcategory?.icon,
            onTap: _pickSubcategory,
          ),
        ],
      ],
    );
  }

  void _pickCategory() {
    AppBottomSheet.show(
      context: context,
      title: 'Select a Category',
      child: _CategoryGrid(
        categories: productCategories,
        onSelected: (category) {
          setState(() {
            _selectedCategory = category;
            _selectedSubcategory = null;
          });
          Navigator.of(context).pop();
        },
      ),
    );
  }

  void _pickSubcategory() {
    final options = productSubcategories[_selectedCategory?.key] ?? const [];
    if (options.isEmpty) return;
    AppBottomSheet.show(
      context: context,
      title: 'Select a Subcategory',
      child: _CategoryGrid(
        categories: options,
        onSelected: (category) {
          setState(() => _selectedSubcategory = category);
          Navigator.of(context).pop();
        },
      ),
    );
  }

  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow('02 — Pricing & Stock'),
        const SizedBox(height: AppSpacing.xl),
        AppTextField(
          controller: _priceController,
          label: 'Price (₦)',
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          controller: _quantityController,
          label: 'Quantity',
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: AppSpacing.lg),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('This product has variants (e.g. size, color)'),
          value: _variantsEnabled,
          onChanged: (v) {
            Haptics.selection();
            setState(() => _variantsEnabled = v);
          },
        ),
        if (_variantsEnabled) ...[
          for (var i = 0; i < _variants.length; i++) _buildVariantRow(i),
          TextButton.icon(
            onPressed: () {
              Haptics.selection();
              setState(() => _variants.add(_VariantDraft()));
            },
            icon: const Icon(LucideIcons.plus, size: 16),
            label: const Text('Add Variant'),
          ),
        ],
      ],
    );
  }

  Widget _buildVariantRow(int index) {
    final variant = _variants[index];
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: AppTextField(
              label: 'Option (e.g. 42)',
              onChanged: (v) => variant.label = v,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: AppTextField(
              label: 'Price',
              keyboardType: TextInputType.number,
              onChanged: (v) => variant.price = v,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: AppTextField(
              label: 'Stock',
              keyboardType: TextInputType.number,
              onChanged: (v) => variant.stock = v,
            ),
          ),
          IconButton(
            tooltip: 'Remove variant',
            icon: const Icon(
              LucideIcons.trash2,
              size: 18,
              color: AppColors.danger,
            ),
            onPressed: () {
              Haptics.selection();
              setState(() => _variants.removeAt(index));
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStep3() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow('03 — Delivery'),
        const SizedBox(height: AppSpacing.xl),
        AppTextField(
          controller: _hostelController,
          label: 'Hostel (pickup location)',
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(controller: _roomController, label: 'Room Number'),
        const SizedBox(height: AppSpacing.md),
        AppTextField(controller: _landmarkController, label: 'Landmark / Zone'),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          controller: _deliveryEstimateController,
          label: 'Delivery Estimate (optional)',
          hint: 'e.g. 1-2 days',
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          controller: _weightController,
          label: 'Estimated Weight (kg, optional)',
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: AppSpacing.md),
        const Text(
          'Dimensions (cm, optional)',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: AppTextField(
                controller: _lengthController,
                label: 'Length',
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppTextField(
                controller: _widthController,
                label: 'Width',
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppTextField(
                controller: _heightController,
                label: 'Height',
                keyboardType: TextInputType.number,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        DropdownButtonFormField<String?>(
          initialValue: _campaignTag,
          decoration: const InputDecoration(labelText: 'Campaign (optional)'),
          items: const [
            DropdownMenuItem(value: null, child: Text('None')),
            DropdownMenuItem(
              value: 'GIRLFRIENDS_DAY',
              child: Text('Girlfriends Day'),
            ),
          ],
          onChanged: (v) => setState(() => _campaignTag = v),
        ),
        const SizedBox(height: AppSpacing.md),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _deliveryAgreementConfirmed,
          onChanged: (v) =>
              setState(() => _deliveryAgreementConfirmed = v ?? false),
          title: const Text(
            'I confirm this item is safe and suitable for motorcycle delivery.',
            style: TextStyle(fontSize: 13),
          ),
        ),
      ],
    );
  }

  Widget _buildStep4() {
    final price = double.tryParse(_priceController.text.trim()) ?? 0;
    final platformFee = price * 0.05;
    final youReceive = price - platformFee;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Review & Confirm',
          style: AppTypography.display(size: 16, weight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          _nameController.text,
          style: AppTypography.display(size: 16, weight: FontWeight.w600),
        ),
        Text('₦${price.toStringAsFixed(0)} • Qty ${_quantityController.text}'),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.info.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Platform Fee Breakdown',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Platform fee (5% of price)'),
                  Text('-₦${platformFee.toStringAsFixed(0)}'),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('You receive per unit sold'),
                  Text(
                    naira(youReceive),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'A further cut (30% of the delivery fee) is also deducted per order — it varies by '
                'the buyer\'s delivery zone, so it isn\'t known until an order is actually placed.',
                style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CategoryPickerField extends StatelessWidget {
  const _CategoryPickerField({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.md),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: context.palette.page,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: context.palette.hairline),
        ),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: AppSpacing.sm),
            ],
            Expanded(child: Text(label)),
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

class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({required this.categories, required this.onSelected});

  final List<ProductCategory> categories;
  final ValueChanged<ProductCategory> onSelected;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: AppSpacing.sm,
        crossAxisSpacing: AppSpacing.sm,
        mainAxisExtent: 84,
      ),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final category = categories[index];
        return InkWell(
          borderRadius: BorderRadius.circular(AppRadii.md),
          onTap: () {
            Haptics.selection();
            onSelected(category);
          },
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: context.palette.page,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(category.icon, color: AppColors.primary),
                const SizedBox(height: 6),
                Text(
                  category.label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Second, explicit consent gate before submit — mirrors the web app's
/// `ConfirmListingModal`: exact fee math, a "list at X to net Y" hint, and
/// its own availability/prohibited-content acknowledgment checkbox
/// (distinct from step 3's motorcycle-delivery-suitability checkbox).
class _ConfirmListingContent extends StatefulWidget {
  const _ConfirmListingContent({required this.price, required this.onConfirm});

  final double price;
  final VoidCallback onConfirm;

  @override
  State<_ConfirmListingContent> createState() => _ConfirmListingContentState();
}

class _ConfirmListingContentState extends State<_ConfirmListingContent> {
  bool _policyAcknowledged = false;

  @override
  Widget build(BuildContext context) {
    final fee = widget.price * 0.05;
    final youReceive = widget.price - fee;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.info.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Listing price'),
                  Text(naira(widget.price)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Platform fee (5%)'),
                  Text('-₦${fee.toStringAsFixed(0)}'),
                ],
              ),
              const Divider(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'You receive per unit sold',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    naira(youReceive),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'To net ₦${widget.price.toStringAsFixed(0)}, list at ₦${(widget.price / 0.95).toStringAsFixed(0)} instead.',
                style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _policyAcknowledged,
          onChanged: (v) {
            Haptics.selection();
            setState(() => _policyAcknowledged = v ?? false);
          },
          title: const Text(
            'I confirm this listing is accurate, mine to sell, and does not '
            'violate BataMart\'s prohibited-content policy.',
            style: TextStyle(fontSize: 13),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        PrimaryButton(
          label: 'Confirm & List Product',
          onPressed: _policyAcknowledged ? widget.onConfirm : null,
        ),
      ],
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < 4; i++) ...[
          CircleAvatar(
            radius: 14,
            backgroundColor: i <= step ? AppColors.primary : context.palette.hairline,
            child: Text(
              '${i + 1}',
              style: TextStyle(
                color: i <= step ? Colors.white : context.palette.inkSecondary,
                fontSize: 12,
              ),
            ),
          ),
          if (i != 3)
            Expanded(
              child: Container(
                height: 2,
                color: i < step ? AppColors.primary : context.palette.hairline,
              ),
            ),
        ],
      ],
    );
  }
}
