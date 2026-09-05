import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/data/category_tree.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/picklist.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../../auth/state/auth_controller.dart';
import '../state/products_providers.dart';
import '../state/recent_searches.dart';
import '../../../core/motion/motion.dart';
import '../../../core/utils/money.dart';

/// Matches WEB_PAGES_REFERENCE.md's "Search" page. Backed by
/// `GET /api/products` (BACKEND_REFERENCE.md §3.3): category, zone
/// (`landmark`), price range, rating, in-stock, and `delivery=fast` are all
/// real, confirmed server-side filters — wired here via [ProductSearchQuery].
/// Full 12-category list mirrored from the web app's `CATEGORY_TREE`
/// (`lib/variants.ts`, no `/api/categories` endpoint exists).
/// (`condition` is deliberately NOT included: unlike the others, there's no
/// confirmed dedicated query param for it in `app/api/products/route.ts`,
/// so a UI for it would silently no-op.)
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit(String value) {
    final query = ref.read(searchQueryProvider);
    ref.read(searchQueryProvider.notifier).state = query.copyWith(
      query: value,
      page: 1,
    );
    ref.read(recentSearchesProvider.notifier).add(value);
  }

  /// Runs a term from the discovery pane, keeping the field in sync so the
  /// user can see and edit what they just ran.
  void _runTerm(String term) {
    _controller.text = term;
    _controller.selection =
        TextSelection.collapsed(offset: term.length);
    _submit(term);
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(searchQueryProvider);
    final resultsAsync = ref.watch(searchResultsProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Search', showBack: true),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              0,
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    autofocus: true,
                    textInputAction: TextInputAction.search,
                    onSubmitted: _submit,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search products, sellers...',
                      prefixIcon: const Icon(LucideIcons.search, size: 18),
                      suffixIcon: _controller.text.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Clear',
                              icon: const Icon(LucideIcons.x, size: 16),
                              onPressed: () {
                                _controller.clear();
                                ref.read(searchQueryProvider.notifier).state =
                                    ref.read(searchQueryProvider).copyWith(
                                          query: '',
                                          page: 1,
                                        );
                                setState(() {});
                              },
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                _FilterButton(
                  activeCount: query.activeFilterCount,
                  onTap: () => _openFilterSheet(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 40,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              scrollDirection: Axis.horizontal,
              itemCount: productCategories.length + 1,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) {
                if (index == 0) {
                  final isSelected = query.categoryKey == null;
                  return ChoiceChip(
                    label: const Text('All'),
                    selected: isSelected,
                    onSelected: (_) =>
                        ref.read(searchQueryProvider.notifier).state = query
                            .copyWith(page: 1, clearCategory: true),
                  );
                }
                final category = productCategories[index - 1];
                final isSelected = query.categoryKey == category.key;
                return ChoiceChip(
                  label: Text(category.label),
                  selected: isSelected,
                  onSelected: (_) =>
                      ref.read(searchQueryProvider.notifier).state = query
                          .copyWith(
                            category: category.label,
                            categoryKey: category.key,
                            page: 1,
                          ),
                );
              },
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                DropdownButton<String>(
                  value: query.sortBy,
                  items: const [
                    DropdownMenuItem(
                      value: 'relevance',
                      child: Text('Relevance'),
                    ),
                    DropdownMenuItem(value: 'newest', child: Text('Newest')),
                    DropdownMenuItem(
                      value: 'price_asc',
                      child: Text('Price: Low to High'),
                    ),
                    DropdownMenuItem(
                      value: 'price_desc',
                      child: Text('Price: High to Low'),
                    ),
                    DropdownMenuItem(value: 'rating', child: Text('Rating')),
                    DropdownMenuItem(value: 'popular', child: Text('Popular')),
                  ],
                  onChanged: (value) {
                    if (value == null) return;
                    ref.read(searchQueryProvider.notifier).state = query
                        .copyWith(sortBy: value);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Expanded(
            child: resultsAsync.when(
              data: (result) {
                // Before anything is typed, the screen offers somewhere to
                // start rather than an empty box. An idle search field asking
                // "what do you want?" is the least useful state in any app.
                if ((query.query ?? '').isEmpty &&
                    query.activeFilterCount == 0) {
                  return _SearchDiscovery(onTerm: _runTerm);
                }
                if (result.products.isEmpty) {
                  return const EmptyState(
                    title: 'No results',
                    message: 'Try a different search term or filter.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref.refresh(searchResultsProvider.future),
                  child: GridView.builder(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: AppSpacing.sm,
                          crossAxisSpacing: AppSpacing.sm,
                          mainAxisExtent: 280,
                        ),
                    itemCount: result.products.length,
                    itemBuilder: (context, index) {
                      final product = result.products[index];
                      return ProductCard(
                        imageUrl: product.thumbnail,
                        name: product.name,
                        price: naira(product.price),
                        percentOff: product.hasDiscount
                            ? product.discountPercent
                            : null,
                        rating: product.avgRating > 0
                            ? product.avgRating
                            : null,
                        reviewCount: product.totalReviews,
                        location: product.landmark,
                        onTap: () => context.push(
                          AppRoutes.productDetailPath(product.id),
                        ),
                      );
                    },
                  ),
                );
              },
              loading: () => const _SearchLoadingSkeleton(),
              error: (error, stackTrace) => ErrorState(
                message: 'Search failed.\n$error',
                onRetry: () => ref.invalidate(searchResultsProvider),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openFilterSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
      ),
      builder: (context) => _FilterSheet(
        initial: ref.read(searchQueryProvider),
        onApply: (updated) {
          ref.read(searchQueryProvider.notifier).state = updated.copyWith(
            page: 1,
          );
        },
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.activeCount, required this.onTap});

  final int activeCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.md),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: activeCount > 0
              ? AppColors.primary.withValues(alpha: 0.1)
              : context.palette.page,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(
            color: activeCount > 0 ? AppColors.primary : context.palette.hairline,
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Icon(
              LucideIcons.slidersHorizontal,
              color: activeCount > 0
                  ? AppColors.primary
                  : context.palette.inkSecondary,
              size: 20,
            ),
            if (activeCount > 0)
              Positioned(
                top: -6,
                right: -6,
                child: CircleAvatar(
                  radius: 8,
                  backgroundColor: AppColors.danger,
                  child: Text(
                    '$activeCount',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Full filter sheet — zone (delivery-area/landmark), price range, minimum
/// rating, in-stock only, and fast-delivery-only. All map to real
/// `GET /api/products` params (BACKEND_REFERENCE.md §3.3).
class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet({required this.initial, required this.onApply});

  final ProductSearchQuery initial;
  final ValueChanged<ProductSearchQuery> onApply;

  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  late String? _zone = widget.initial.zone;
  late final _minController = TextEditingController(
    text: widget.initial.minPrice?.toStringAsFixed(0),
  );
  late final _maxController = TextEditingController(
    text: widget.initial.maxPrice?.toStringAsFixed(0),
  );
  late double? _minRating = widget.initial.minRating;
  late bool _inStock = widget.initial.inStock;
  late bool _fastDelivery = widget.initial.fastDeliveryOnly;

  @override
  void dispose() {
    _minController.dispose();
    _maxController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final university = ref.watch(authControllerProvider).user?.university;
    final zones = extractPicklist(university?.deliveryAreas);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.lg,
          right: AppSpacing.lg,
          top: AppSpacing.lg,
          bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Filters',
                    style: AppTypography.display(size: 18, weight: FontWeight.w700),
                  ),
                  TextButton(
                    onPressed: () => setState(() {
                      _zone = null;
                      _minController.clear();
                      _maxController.clear();
                      _minRating = null;
                      _inStock = false;
                      _fastDelivery = false;
                    }),
                    child: const Text('Clear all'),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              if (zones.isNotEmpty) ...[
                const Text(
                  'Delivery Zone',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: zones
                      .map(
                        (zone) => ChoiceChip(
                          label: Text(zone),
                          selected: _zone == zone,
                          onSelected: (selected) =>
                              setState(() => _zone = selected ? zone : null),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              const Text(
                'Price Range (₦)',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _minController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(hintText: 'Min'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  const Text('—'),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: TextField(
                      controller: _maxController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(hintText: 'Max'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              const Text(
                'Minimum Rating',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                children: [4, 3, 2]
                    .map(
                      (stars) => ChoiceChip(
                        label: Text('$stars+ ★'),
                        selected: _minRating == stars.toDouble(),
                        onSelected: (selected) => setState(
                          () => _minRating = selected ? stars.toDouble() : null,
                        ),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.lg),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('In stock only'),
                value: _inStock,
                onChanged: (value) => setState(() => _inStock = value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Fast delivery only'),
                value: _fastDelivery,
                onChanged: (value) => setState(() => _fastDelivery = value),
              ),
              const SizedBox(height: AppSpacing.lg),
              PrimaryButton(
                label: 'Apply Filters',
                onPressed: () {
                  widget.onApply(
                    widget.initial.copyWith(
                      zone: _zone,
                      minPrice: double.tryParse(_minController.text),
                      maxPrice: double.tryParse(_maxController.text),
                      minRating: _minRating,
                      clearMinPrice: _minController.text.isEmpty,
                      clearMaxPrice: _maxController.text.isEmpty,
                      clearMinRating: _minRating == null,
                      inStock: _inStock,
                      fastDeliveryOnly: _fastDelivery,
                    ),
                  );
                  Navigator.of(context).pop();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SearchLoadingSkeleton extends StatelessWidget {
  const _SearchLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(AppSpacing.lg),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.sm,
        crossAxisSpacing: AppSpacing.sm,
        mainAxisExtent: 280,
      ),
      itemCount: 6,
      itemBuilder: (context, index) => const ProductCardSkeleton(),
    );
  }
}


/// Shown while the search field is empty: what you looked for before, and
/// what is worth looking for.
class _SearchDiscovery extends ConsumerWidget {
  const _SearchDiscovery({required this.onTerm});

  final ValueChanged<String> onTerm;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.palette;
    final recent = ref.watch(recentSearchesProvider);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        if (recent.isNotEmpty) ...[
          Row(
            children: [
              Text(
                'RECENT SEARCHES',
                style: AppTypography.label(size: 10, color: palette.inkSecondary),
              ),
              const Spacer(),
              Pressable(
                onTap: () => ref.read(recentSearchesProvider.notifier).clear(),
                child: Text(
                  'CLEAR ALL',
                  style: AppTypography.label(size: 10, color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final (i, term) in recent.indexed)
                _TermChip(
                  label: term,
                  icon: LucideIcons.clock3,
                  onTap: () => onTerm(term),
                  onRemove: () =>
                      ref.read(recentSearchesProvider.notifier).remove(term),
                ).enter(index: i),
            ],
          ),
          const SizedBox(height: AppSpacing.section),
        ],

        Text(
          'POPULAR ON CAMPUS',
          style: AppTypography.label(size: 10, color: palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final (i, term) in trendingSearches.indexed)
              _TermChip(
                label: term,
                icon: LucideIcons.trendingUp,
                onTap: () => onTerm(term),
              ).enter(index: i),
          ],
        ),

        const SizedBox(height: AppSpacing.section),
        Text(
          'BROWSE BY CATEGORY',
          style: AppTypography.label(size: 10, color: palette.inkSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final (i, category) in productCategories.indexed)
          Pressable(
            onTap: () {
              ref.read(searchQueryProvider.notifier).state = ProductSearchQuery(
                category: category.label,
                categoryKey: category.key,
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: palette.hairline)),
              ),
              child: Row(
                children: [
                  Icon(category.icon, size: 16, color: palette.inkMuted),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: Text(category.label, style: const TextStyle(fontSize: 14))),
                  Text(
                    '${(productSubcategories[category.key] ?? const []).length}',
                    style: AppTypography.label(size: 10, color: palette.inkMuted),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Icon(LucideIcons.chevronRight, size: 15, color: palette.inkMuted),
                ],
              ),
            ),
          ).enter(index: i),
      ],
    );
  }
}

/// A tappable search term. Recent terms can be dismissed individually.
class _TermChip extends StatelessWidget {
  const _TermChip({
    required this.label,
    required this.icon,
    required this.onTap,
    this.onRemove,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Pressable(
      onTap: onTap,
      scale: 0.95,
      child: Container(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm + 2,
          onRemove == null ? AppSpacing.md : AppSpacing.sm,
          AppSpacing.sm + 2,
        ),
        decoration: BoxDecoration(
          color: palette.card,
          border: Border.all(color: palette.hairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: palette.inkMuted),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(fontSize: 12.5)),
            if (onRemove != null) ...[
              const SizedBox(width: 4),
              Pressable(
                onTap: onRemove,
                child: Padding(
                  padding: const EdgeInsets.all(3),
                  child: Icon(LucideIcons.x, size: 12, color: palette.inkMuted),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
