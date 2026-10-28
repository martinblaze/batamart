import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/data/category_images.dart';
import '../../../core/data/category_tree.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../state/products_providers.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';

/// Deals.
///
/// The category picker was a single horizontal chip rail, which is the worst
/// shape for twelve categories: only three fit on screen, the rest are found
/// by guessing there is more to the right, and subcategories had nowhere to
/// live at all.
///
/// It is now a vertical rail down the left edge — the pattern every large
/// catalogue app converges on, because it shows roughly ten categories at once
/// and leaves the full width of the screen for the results. Selecting a
/// category reveals its subcategories above the grid.
class DealsScreen extends ConsumerWidget {
  const DealsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(dealsQueryProvider);
    final resultsAsync = ref.watch(dealsResultsProvider);

    // The rail tracks the parent category; the strip tracks the subcategory.
    // Previously both read categoryKey, so arriving with a subcategory
    // selected highlighted nothing and hid the strip entirely.
    final selected = query.categoryKey;
    final selectedSub = query.subcategoryKey;
    final subs = selected == null
        ? const <ProductCategory>[]
        : (productSubcategories[selected] ?? const []);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CategoryRail(
          selectedKey: selected,
          onAll: () => ref.read(dealsQueryProvider.notifier).state =
              query.copyWith(page: 1, clearCategory: true),
          // Changing category drops any subcategory — otherwise the old
          // child would silently filter the new parent to nothing.
          onSelect: (category) => ref.read(dealsQueryProvider.notifier).state =
              ProductSearchQuery(
                sortBy: query.sortBy,
                category: category.label,
                categoryKey: category.key,
                minPrice: query.minPrice,
                maxPrice: query.maxPrice,
                minRating: query.minRating,
                inStock: query.inStock,
                fastDeliveryOnly: query.fastDeliveryOnly,
              ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DealsFilterBar(query: query),
              if (subs.isNotEmpty)
                _SubcategoryStrip(
                  subs: subs,
                  selectedKey: selectedSub,
                  // Filters in place rather than pushing Search. A
                  // subcategory is a narrowing of what is already on screen,
                  // so it should narrow it, not navigate away from it.
                  // Tapping the active subcategory clears it, so there is
                  // always a way back up to the whole category.
                  onTap: (sub) {
                    final isActive = selectedSub == sub.key;
                    ref.read(dealsQueryProvider.notifier).state =
                        ProductSearchQuery(
                          sortBy: query.sortBy,
                          category: query.category,
                          categoryKey: query.categoryKey,
                          subcategoryKey: isActive ? null : sub.key,
                          minPrice: query.minPrice,
                          maxPrice: query.maxPrice,
                          minRating: query.minRating,
                          inStock: query.inStock,
                          fastDeliveryOnly: query.fastDeliveryOnly,
                        );
                  },
                ),
              Expanded(
                child: resultsAsync.when(
                  data: (result) {
                    if (result.products.isEmpty) {
                      return EmptyState(
                        icon: LucideIcons.tag,
                        title: 'No deals here yet',
                        message: selected == null
                            ? 'Nothing is discounted right now. Check back later.'
                            : 'No discounted items in this category yet.',
                        actionLabel: selected == null ? null : 'Show all deals',
                        onActionTap: selected == null
                            ? null
                            : () => ref.read(dealsQueryProvider.notifier).state =
                                query.copyWith(page: 1, clearCategory: true),
                      );
                    }
                    return RefreshIndicator(
                      onRefresh: () => ref.refresh(dealsResultsProvider.future),
                      child: GridView.builder(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.md,
                          AppSpacing.md,
                          AppSpacing.md,
                          AppSpacing.xxl,
                        ),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: AppSpacing.lg,
                          crossAxisSpacing: AppSpacing.sm,
                          mainAxisExtent: 288,
                        ),
                        itemCount: result.products.length,
                        itemBuilder: (context, index) {
                          final product = result.products[index];
                          return ProductCard(
                            imageUrl: product.thumbnail,
                            name: product.name,
                            price: naira(product.price),
                            isHot: product.isHot,
                            percentOff: product.hasDiscount
                                ? product.discountPercent
                                : null,
                            rating:
                                product.avgRating > 0 ? product.avgRating : null,
                            reviewCount: product.totalReviews,
                            location: product.landmark,
                            onTap: () => context.push(
                              AppRoutes.productDetailPath(product.id),
                            ),
                          ).enter(index: index);
                        },
                      ),
                    );
                  },
                  loading: () => GridView.builder(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: AppSpacing.lg,
                      crossAxisSpacing: AppSpacing.sm,
                      mainAxisExtent: 288,
                    ),
                    itemCount: 6,
                    itemBuilder: (context, index) => const ProductCardSkeleton(),
                  ),
                  error: (error, stackTrace) => ErrorState(
                    message: 'Could not load deals.\n$error',
                    onRetry: () => ref.invalidate(dealsResultsProvider),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The vertical category rail. Each row carries its category's photograph as a
/// small thumbnail, so the list is scannable by picture as well as by name.
class _CategoryRail extends StatelessWidget {
  const _CategoryRail({
    required this.selectedKey,
    required this.onAll,
    required this.onSelect,
  });

  final String? selectedKey;
  final VoidCallback onAll;
  final ValueChanged<ProductCategory> onSelect;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      width: 96,
      decoration: BoxDecoration(
        color: palette.page,
        border: Border(right: BorderSide(color: palette.hairline)),
      ),
      child: ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: productCategories.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _RailItem(
              label: 'All',
              isSelected: selectedKey == null,
              onTap: onAll,
            );
          }
          final category = productCategories[index - 1];
          return _RailItem(
            label: category.label,
            image: categoryImage(category.key),
            icon: category.icon,
            isSelected: selectedKey == category.key,
            onTap: () => onSelect(category),
          );
        },
      ),
    );
  }
}

class _RailItem extends StatelessWidget {
  const _RailItem({
    required this.label,
    required this.isSelected,
    required this.onTap,
    this.image,
    this.icon,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final String? image;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Pressable(
      onTap: onTap,
      scale: 0.95,
      child: AnimatedContainer(
        duration: Motion.base,
        curve: Motion.ease,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: isSelected ? palette.card : Colors.transparent,
          border: Border(
            // A marker on the leading edge rather than a filled pill: in a
            // list this long a filled row reads as a button, not a position.
            left: BorderSide(
              color: isSelected ? AppColors.primary : Colors.transparent,
              width: 2.5,
            ),
          ),
        ),
        child: Column(
          children: [
            if (image != null)
              SizedBox(
                width: 40,
                height: 40,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                  child: Image.asset(image!, fit: BoxFit.cover),
                ),
              )
            else
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(border: Border.all(color: palette.hairline)),
                child: Icon(icon ?? LucideIcons.layoutGrid, size: 16, color: palette.ink),
              ),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                label,
                maxLines: 2,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10.5,
                  height: 1.25,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected ? palette.ink : palette.inkSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Subcategories for the selected category, above the results.
class _SubcategoryStrip extends StatelessWidget {
  const _SubcategoryStrip({
    required this.subs,
    required this.onTap,
    this.selectedKey,
  });

  final List<ProductCategory> subs;
  final ValueChanged<ProductCategory> onTap;
  final String? selectedKey;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      height: 40,
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: palette.hairline)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        itemCount: subs.length,
        separatorBuilder: (context, index) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) {
          final sub = subs[index];
          final isSelected = selectedKey == sub.key;
          return Pressable(
            onTap: () => onTap(sub),
            child: Center(
              child: Text(
                sub.label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                  color: isSelected ? palette.ink : palette.inkSecondary,
                  decoration: isSelected ? TextDecoration.underline : null,
                  decorationThickness: 2,
                ),
              ),
            ),
          ).enterX(index: index);
        },
      ),
    );
  }
}


const _sortLabels = {
  'popular': 'Most popular',
  'newest': 'Newest first',
  'price_asc': 'Price: low to high',
  'price_desc': 'Price: high to low',
  'rating': 'Best rated',
  'relevance': 'Relevance',
};

/// Sort + filter controls above the deals grid. Deals had no controls at all
/// beyond the category rail, so a price band picked on the Home feed had
/// nowhere to land.
class _DealsFilterBar extends ConsumerWidget {
  const _DealsFilterBar({required this.query});

  final ProductSearchQuery query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final count = query.activeFilterCount;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.card,
        border: Border(bottom: BorderSide(color: palette.hairline)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Pressable(
              onTap: () => _openSortSheet(context, ref, query),
              child: Row(
                children: [
                  Icon(LucideIcons.arrowUpDown, size: 14, color: palette.inkMuted),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      _sortLabels[query.sortBy] ?? 'Sort',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: palette.ink),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(width: 1, height: 18, color: palette.hairline),
          const SizedBox(width: AppSpacing.md),
          Pressable(
            onTap: () => _openFilterSheet(context, ref, query),
            child: Row(
              children: [
                Icon(LucideIcons.slidersHorizontal, size: 14, color: palette.inkMuted),
                const SizedBox(width: 6),
                Text('Filters', style: TextStyle(fontSize: 12, color: palette.ink)),
                if (count > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    color: AppColors.primary,
                    child: Text(
                      '$count',
                      style: AppTypography.label(size: 9, color: Colors.white),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (count > 0) ...[
            const SizedBox(width: AppSpacing.md),
            Pressable(
              onTap: () => ref.read(dealsQueryProvider.notifier).state =
                  const ProductSearchQuery(sortBy: 'popular'),
              child: Text(
                'CLEAR',
                style: AppTypography.label(size: 9, color: AppColors.danger),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

void _openSortSheet(BuildContext context, WidgetRef ref, ProductSearchQuery query) {
  AppBottomSheet.show(
    context: context,
    title: 'Sort by',
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final entry in _sortLabels.entries)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(entry.value),
            trailing: query.sortBy == entry.key
                ? const Icon(LucideIcons.check, size: 18, color: AppColors.primary)
                : null,
            onTap: () {
              ref.read(dealsQueryProvider.notifier).state =
                  query.copyWith(sortBy: entry.key, page: 1);
              Navigator.of(context).pop();
            },
          ),
      ],
    ),
  );
}

void _openFilterSheet(BuildContext context, WidgetRef ref, ProductSearchQuery query) {
  AppBottomSheet.show(
    context: context,
    title: 'Filters',
    child: _DealsFilterForm(query: query),
  );
}

class _DealsFilterForm extends ConsumerStatefulWidget {
  const _DealsFilterForm({required this.query});

  final ProductSearchQuery query;

  @override
  ConsumerState<_DealsFilterForm> createState() => _DealsFilterFormState();
}

class _DealsFilterFormState extends ConsumerState<_DealsFilterForm> {
  late final _minController =
      TextEditingController(text: widget.query.minPrice?.toStringAsFixed(0) ?? '');
  late final _maxController =
      TextEditingController(text: widget.query.maxPrice?.toStringAsFixed(0) ?? '');
  late bool _inStock = widget.query.inStock;
  late bool _fastDelivery = widget.query.fastDeliveryOnly;
  late double? _minRating = widget.query.minRating;

  @override
  void dispose() {
    _minController.dispose();
    _maxController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('PRICE RANGE', style: AppTypography.label(size: 10, color: palette.inkSecondary)),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _minController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(hintText: 'Min', prefixText: '₦'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: TextField(
                controller: _maxController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(hintText: 'Max', prefixText: '₦'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        Text('MINIMUM RATING', style: AppTypography.label(size: 10, color: palette.inkSecondary)),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          children: [
            for (final r in [null, 3.0, 4.0, 4.5])
              ChoiceChip(
                label: Text(r == null ? 'Any' : '$r+'),
                selected: _minRating == r,
                onSelected: (_) => setState(() => _minRating = r),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _inStock,
          onChanged: (v) => setState(() => _inStock = v ?? false),
          title: const Text('In stock only', style: TextStyle(fontSize: 14)),
        ),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _fastDelivery,
          onChanged: (v) => setState(() => _fastDelivery = v ?? false),
          title: const Text('Fast delivery only', style: TextStyle(fontSize: 14)),
        ),
        const SizedBox(height: AppSpacing.md),
        PrimaryButton(
          label: 'Apply filters',
          onPressed: () {
            final min = double.tryParse(_minController.text.trim());
            final max = double.tryParse(_maxController.text.trim());
            ref.read(dealsQueryProvider.notifier).state = widget.query.copyWith(
              minPrice: min,
              maxPrice: max,
              clearMinPrice: min == null,
              clearMaxPrice: max == null,
              minRating: _minRating,
              clearMinRating: _minRating == null,
              inStock: _inStock,
              fastDeliveryOnly: _fastDelivery,
              page: 1,
            );
            Navigator.of(context).pop();
          },
        ),
      ],
    );
  }
}
