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
import '../data/category_attribute.dart';
import '../state/seller_providers.dart';
import '../../../core/utils/money.dart';

/// Per-combination price/stock overrides in the Variant Inventory grid.
/// Blank means "inherit the product's own price/quantity", matching the web
/// form, so a seller who only wants sizes never has to retype the price.
class _VariantPriceRow {
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
  /// Category Details for the current category/subcategory, fetched from
  /// `GET /api/category-attributes`. Empty is a normal state — plenty of
  /// categories have no structured fields configured.
  List<CategoryAttributeDef> _categoryAttributes = const [];
  bool _loadingAttributes = false;

  /// attribute key -> selected value(s). Choice attributes hold a
  /// `List<String>`; text/number/boolean hold a single `String`.
  final Map<String, dynamic> _attributeValues = {};

  /// combination key -> price/stock overrides for that variant.
  final Map<String, _VariantPriceRow> _variantPricing = {};

  /// Set once the seller types in the Description field. From then on the
  /// auto-generated text stops overwriting it — matching the web form, where
  /// `descriptionEdited` gates the same effect. Without it, picking another
  /// Category Detail would silently wipe whatever they had written.
  bool _descriptionEdited = false;
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

    // The product name feeds the auto description, so it has to be watched
    // rather than only read at submit.
    _nameController.addListener(_refreshAutoDescription);
    _descriptionController.addListener(_markDescriptionEdited);
  }

  void _markDescriptionEdited() {
    if (_descriptionEdited) return;
    // Ignore the programmatic writes made by [_refreshAutoDescription] itself,
    // which would otherwise mark the field edited the first time it fills in.
    if (_descriptionController.text == _buildAutoDescription()) return;
    _descriptionEdited = true;
  }

  /// Rewrites the Description from the name, category and Category Details,
  /// unless the seller has already written their own.
  void _refreshAutoDescription() {
    if (_descriptionEdited) return;
    final auto = _buildAutoDescription();
    if (_descriptionController.text == auto) return;
    _descriptionController.value = TextEditingValue(
      text: auto,
      selection: TextSelection.collapsed(offset: auto.length),
    );
  }

  /// "Name. in Category · Subcategory. Label: value; Label: value", capped at
  /// [_descriptionWordLimit] words — the same shape as the web form's
  /// `buildAutoDescription`, so a listing reads the same whichever client
  /// created it.
  String _buildAutoDescription() {
    final parts = <String>[];
    final title = _normalizeSpaces(_nameController.text);
    if (title.isNotEmpty) parts.add(title);

    final context = [
      _selectedCategory?.label ?? '',
      _selectedSubcategory?.label ?? '',
    ].where((e) => e.isNotEmpty).join(' · ');
    if (context.isNotEmpty) parts.add('in $context');

    final summary = _categoryAttributes
        .map((attribute) {
          final values = _valuesFor(attribute.key);
          if (values.isEmpty) return '';
          final formatted = attribute.type == 'boolean'
              ? (values.first == 'true' ? 'Yes' : 'No')
              : values.join(', ');
          return '${attribute.label}: $formatted';
        })
        .where((e) => e.isNotEmpty)
        .take(5)
        .join('; ');
    if (summary.isNotEmpty) parts.add(summary);

    return _limitWords(_normalizeSpaces(parts.join('. ')));
  }

  static String _normalizeSpaces(String text) =>
      text.replaceAll(RegExp(r'\s+'), ' ').trim();

  static String _limitWords(String text) {
    final words = text.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
    if (words.length <= _descriptionWordLimit) return words.join(' ');
    return words.take(_descriptionWordLimit).join(' ');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _nameController.removeListener(_refreshAutoDescription);
    _descriptionController.removeListener(_markDescriptionEdited);
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

  /// Loads the structured fields for the chosen category/subcategory.
  ///
  /// Deliberately non-fatal: Category Details improve search and drive
  /// variants, but a seller must still be able to list when the request fails,
  /// so an error clears the section rather than blocking the flow.
  Future<void> _loadCategoryAttributes() async {
    final categoryKey = _selectedCategory?.key;
    if (categoryKey == null) {
      setState(() {
        _categoryAttributes = const [];
        _attributeValues.clear();
        _variantPricing.clear();
      });
      return;
    }
    setState(() => _loadingAttributes = true);
    try {
      final attributes = await ref
          .read(sellerProductsRepositoryProvider)
          .fetchCategoryAttributes(
            categoryKey: categoryKey,
            subcategoryKey: _selectedSubcategory?.key,
          );
      if (!mounted) return;
      setState(() {
        _categoryAttributes = attributes;
        _refreshAutoDescription();
        // Values for fields that no longer apply would otherwise be submitted
        // for a category that never asked for them.
        final keys = attributes.map((a) => a.key).toSet();
        _attributeValues.removeWhere((key, _) => !keys.contains(key));
        _variantPricing.clear();
      });
    } catch (_) {
      if (mounted) setState(() => _categoryAttributes = const []);
    } finally {
      if (mounted) setState(() => _loadingAttributes = false);
    }
  }

  /// Every value picked for [key], as a flat list. Single-valued types return
  /// a one-item list so callers never have to branch on the storage shape.
  List<String> _valuesFor(String key) {
    final value = _attributeValues[key];
    if (value == null) return const [];
    if (value is List) {
      return value
          .map((e) => e.toString().trim())
          .where((e) => e.isNotEmpty)
          .toList();
    }
    final single = value.toString().trim();
    return single.isEmpty ? const [] : [single];
  }

  /// A Category Detail becomes a variant axis the moment the seller picks two
  /// or more values for it — the same rule the web form uses. There is no
  /// separate "this product has variants" toggle to find or forget.
  List<CategoryAttributeDef> get _variantFields => _categoryAttributes
      .where((a) => a.isChoice && _valuesFor(a.key).length >= 2)
      .toList();

  /// The cartesian product of every variant axis: {Size: M, Color: Red}, and
  /// so on for each combination the seller's choices imply.
  List<Map<String, String>> get _variantCombinations {
    var rows = <Map<String, String>>[];
    for (final field in _variantFields) {
      final values = _valuesFor(field.key);
      if (rows.isEmpty) {
        rows = values.map((v) => {field.key: v}).toList();
        continue;
      }
      final next = <Map<String, String>>[];
      for (final row in rows) {
        for (final value in values) {
          next.add({...row, field.key: value});
        }
      }
      rows = next;
    }
    return rows;
  }

  /// Stable identity for a combination, matching the web's `comboKey` so the
  /// two clients key their pricing grids the same way.
  String _comboKey(Map<String, String> combo) =>
      _variantFields.map((f) => '${f.key}:${combo[f.key]}').join('|');

  _VariantPriceRow _rowFor(Map<String, String> combo) => _variantPricing
      .putIfAbsent(_comboKey(combo), () => _VariantPriceRow());

  /// Toggles one option on a choice attribute. Selecting a second value is
  /// what silently turns the attribute into a variant axis, so the pricing
  /// grid has to be rebuilt whenever this changes.
  void _toggleAttributeOption(String key, String option) {
    Haptics.selection();
    setState(() {
      final current = List<String>.from(_valuesFor(key));
      if (current.contains(option)) {
        current.remove(option);
      } else {
        current.add(option);
      }
      _attributeValues[key] = current;
      _variantPricing.clear();
      _refreshAutoDescription();
    });
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

  /// Parsed delivery estimate in days, or null when the field is not a valid
  /// number. The field is validated to 1-30 before submit.
  int? get _deliveryDays => int.tryParse(_deliveryEstimateController.text.trim());

  /// Matches DESCRIPTION_WORD_LIMIT in the web sell form.
  static const int _descriptionWordLimit = 50;

  /// Mirrors `MAX_LISTING_STOCK` in `app/api/products/route.ts`, which rejects
  /// a listing whose total stock exceeds it.
  static const int _maxStock = 100;

  /// The first thing wrong with [step], or null when it is complete.
  ///
  /// Returning a message rather than a bool is what lets "Next" say which
  /// field is missing. Previously two coarse getters allowed a seller through
  /// step 1 with no image, no subcategory and an upload still in flight — and
  /// the failure only surfaced at submit, several steps later.
  String? _validateStep(int step) {
    switch (step) {
      case 0:
        if (_nameController.text.trim().isEmpty) {
          return 'Product name is required.';
        }
        if (_isUploadingImage) {
          return 'Wait for the image to finish uploading.';
        }
        if (_images.isEmpty) {
          return 'Add at least 1 product image.';
        }
        if (_selectedCategory == null) {
          return 'Select a category.';
        }
        final subcategories =
            productSubcategories[_selectedCategory?.key] ?? const [];
        if (subcategories.isNotEmpty && _selectedSubcategory == null) {
          return 'Select a subcategory.';
        }
        for (final attribute in _categoryAttributes) {
          if (attribute.required && _valuesFor(attribute.key).isEmpty) {
            return '${attribute.label} is required.';
          }
        }
        return null;

      case 1:
        final price = double.tryParse(_priceController.text.trim()) ?? 0;
        if (price <= 0) return 'Enter a valid price.';
        final quantity = int.tryParse(_quantityController.text.trim()) ?? 0;
        if (quantity < 1 || quantity > _maxStock) {
          return 'Quantity must be between 1 and $_maxStock.';
        }
        final combinations = _variantCombinations;
        if (combinations.isNotEmpty) {
          var total = 0;
          for (final combination in combinations) {
            final row = _variantPricing[_comboKey(combination)];
            final rowPrice =
                double.tryParse(row?.price.trim() ?? '') ?? price;
            final rowStock = int.tryParse(row?.stock.trim() ?? '') ?? quantity;
            if (rowPrice <= 0) return 'Each variant needs a valid price.';
            if (rowStock < 0 || rowStock > _maxStock) {
              return 'Each variant stock must be between 0 and $_maxStock.';
            }
            total += rowStock;
          }
          if (total > _maxStock) {
            return 'Total variant stock cannot exceed $_maxStock.';
          }
        }
        return null;

      case 2:
        final days = int.tryParse(_deliveryEstimateController.text.trim());
        if (days == null || days < 1 || days > 30) {
          return 'Enter an estimated delivery time between 1 and 30 days.';
        }
        return null;

      default:
        return null;
    }
  }

  void _next() {
    final problem = _validateStep(_step);
    if (problem != null) {
      Haptics.error();
      setState(() => _error = problem);
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
    // Re-check every earlier step, not just this one: values can be edited
    // after passing their step, and the API rejects the same conditions.
    for (var step = 0; step <= 2; step++) {
      final problem = _validateStep(step);
      if (problem != null) {
        Haptics.error();
        setState(() {
          _step = step;
          _error = problem;
        });
        return;
      }
    }
    if (!_deliveryAgreementConfirmed) {
      Haptics.error();
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
      final basePrice = double.tryParse(_priceController.text.trim()) ?? 0;
      final baseStock = int.tryParse(_quantityController.text.trim()) ?? 0;

      // One entry per combination the Category Details imply. A blank cell in
      // the grid falls back to the product-level price/stock, which is what
      // makes "three sizes, same price" a zero-typing case.
      final combinations = _variantCombinations;
      final variants = combinations.isEmpty
          ? null
          : combinations.map((combination) {
              final row = _variantPricing[_comboKey(combination)];
              return {
                'combination': combination,
                'price':
                    double.tryParse(row?.price.trim() ?? '') ?? basePrice,
                'stock': int.tryParse(row?.stock.trim() ?? '') ?? baseStock,
              };
            }).toList();

      final attributes = <Map<String, dynamic>>[];
      for (final attribute in _categoryAttributes) {
        final values = _valuesFor(attribute.key);
        if (values.isEmpty) continue;
        // Choice attributes stay arrays even when a single value is picked:
        // the API stores them as JSON and the search filters match with
        // `array_contains`, so collapsing to a scalar would make the listing
        // invisible to its own category filters.
        final Object value;
        if (attribute.isChoice) {
          value = values;
        } else if (attribute.type == 'boolean') {
          value = values.first == 'true';
        } else if (attribute.type == 'number') {
          value = num.tryParse(values.first) ?? values.first;
        } else {
          value = values.first;
        }
        attributes.add({
          'key': attribute.key,
          'label': attribute.label,
          'value': value,
          'searchable': attribute.searchable,
          'filterable': attribute.filterable,
        });
      }

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
            // The field now takes a plain number of days, but the API stores
            // deliveryEstimate as free text and parses it back out for the
            // "fast delivery" filter (isFastDelivery in
            // app/api/products/route.ts). Sending a bare "3" would never match
            // that parser, so it is formatted exactly as the web form sends it.
            deliveryEstimate: _deliveryDays == null
                ? null
                : '$_deliveryDays day${_deliveryDays == 1 ? '' : 's'}',
            campaignTag: _campaignTag,
            variants: variants,
            attributes: attributes,
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
            label: _selectedSubcategory?.label ?? 'Select a subcategory',
            icon: _selectedSubcategory?.icon,
            onTap: _pickSubcategory,
          ),
        ],
        _buildCategoryDetails(),
      ],
    );
  }

  /// The web form's "Category Details": structured, per-category fields that
  /// feed search filters and, once two or more values are picked for one,
  /// become the product's variants.
  Widget _buildCategoryDetails() {
    if (_selectedCategory == null) return const SizedBox.shrink();
    if (_loadingAttributes) {
      return const Padding(
        padding: EdgeInsets.only(top: AppSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_categoryAttributes.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.xl),
        Text(
          'Category Details',
          style: AppTypography.display(size: 15, weight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          'Pick more than one value for a field and it becomes a variant you '
          'can price separately.',
          style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final attribute in _categoryAttributes)
          _buildAttributeField(attribute),
      ],
    );
  }

  Widget _buildAttributeField(CategoryAttributeDef attribute) {
    final selected = _valuesFor(attribute.key);
    final custom =
        selected.where((v) => !attribute.options.contains(v)).toList();

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            attribute.required ? '${attribute.label} *' : attribute.label,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (attribute.isChoice) ...[
            if (attribute.options.isNotEmpty)
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final option in attribute.options)
                    _AttributeChip(
                      label: option,
                      selected: selected.contains(option),
                      onTap: () =>
                          _toggleAttributeOption(attribute.key, option),
                    ),
                ],
              ),
            // Values the seller typed themselves sit alongside the suggestions
            // so they can be removed the same way.
            if (custom.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final value in custom)
                    _AttributeChip(
                      label: value,
                      selected: true,
                      onTap: () =>
                          _toggleAttributeOption(attribute.key, value),
                    ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            _CustomAttributeValueField(
              hint: 'Add custom ${attribute.label.toLowerCase()}...',
              onSubmitted: (value) {
                final trimmed = value.trim();
                if (trimmed.isEmpty || selected.contains(trimmed)) return;
                _toggleAttributeOption(attribute.key, trimmed);
              },
            ),
          ] else if (attribute.type == 'boolean')
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(attribute.label),
              value:
                  (_attributeValues[attribute.key]?.toString() ?? '') == 'true',
              onChanged: (value) {
                Haptics.selection();
                setState(
                  () => _attributeValues[attribute.key] = value.toString(),
                );
              },
            )
          else
            AppTextField(
              label: attribute.label,
              keyboardType: attribute.type == 'number'
                  ? TextInputType.number
                  : TextInputType.text,
              onChanged: (value) => _attributeValues[attribute.key] = value,
            ),
        ],
      ),
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
          _loadCategoryAttributes();
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
          // Subcategory attributes override category-level ones for the same
          // key, so the list must be refetched, not merged client-side.
          _loadCategoryAttributes();
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
        _buildVariantInventory(),
      ],
    );
  }

  /// Appears on its own once the seller's Category Details imply more than one
  /// combination — no toggle, matching the web form. A blank price or stock
  /// inherits the product-level value, so a seller adding three sizes at one
  /// price fills in nothing here.
  Widget _buildVariantInventory() {
    final combinations = _variantCombinations;
    if (combinations.isEmpty) return const SizedBox.shrink();

    final fields = _variantFields;
    final axes = fields.map((f) => f.label).join(' x ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.xl),
        Text(
          'Variant Inventory',
          style: AppTypography.display(size: 15, weight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          '${combinations.length} combination${combinations.length == 1 ? '' : 's'} '
          'from $axes. Leave a row blank to use the price and quantity above.',
          style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final combination in combinations)
          _buildVariantInventoryRow(combination, fields),
      ],
    );
  }

  Widget _buildVariantInventoryRow(
    Map<String, String> combination,
    List<CategoryAttributeDef> fields,
  ) {
    final key = _comboKey(combination);
    final row = _rowFor(combination);
    final label =
        fields.map((f) => '${f.label}: ${combination[f.key]}').join('  ·  ');

    return Padding(
      // Keyed on the combination so Flutter cannot reuse a previous row's text
      // fields for a different variant when the seller changes their Category
      // Details -- the price typed for "Size: M" must not reappear under
      // "Size: L".
      key: ValueKey(key),
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: AppTextField(
                  label: 'Price',
                  keyboardType: TextInputType.number,
                  onChanged: (value) => row.price = value,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppTextField(
                  label: 'Stock',
                  keyboardType: TextInputType.number,
                  onChanged: (value) => row.stock = value,
                ),
              ),
            ],
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
          label: 'Delivery Estimate (days) *',
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

/// A selectable value in a Category Details field. Multi-select by design:
/// picking a second value is exactly what turns the attribute into a variant
/// axis, so single-selection would make variants unreachable.
class _AttributeChip extends StatelessWidget {
  const _AttributeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.md),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : context.palette.card,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(
            color: selected ? AppColors.primary : context.palette.hairline,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              selected ? LucideIcons.circleCheck : LucideIcons.plus,
              size: 13,
              color: selected ? Colors.white : context.palette.inkSecondary,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : context.palette.inkSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Free-text entry for a Category Details value the suggestion list doesn't
/// cover. Stateful only to own its controller, so the field can clear itself
/// once the value has been added as a chip.
class _CustomAttributeValueField extends StatefulWidget {
  const _CustomAttributeValueField({
    required this.hint,
    required this.onSubmitted,
  });

  final String hint;
  final ValueChanged<String> onSubmitted;

  @override
  State<_CustomAttributeValueField> createState() =>
      _CustomAttributeValueFieldState();
}

class _CustomAttributeValueFieldState
    extends State<_CustomAttributeValueField> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text;
    if (value.trim().isEmpty) return;
    widget.onSubmitted(value);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _controller,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: widget.hint,
              hintStyle: TextStyle(
                fontSize: 12,
                color: context.palette.inkMuted,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
            ),
          ),
        ),
        IconButton(
          tooltip: 'Add value',
          icon: const Icon(LucideIcons.plus, size: 18),
          onPressed: _submit,
        ),
      ],
    );
  }
}
