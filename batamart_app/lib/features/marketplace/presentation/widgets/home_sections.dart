import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/data/category_images.dart';
import '../../../../core/data/category_tree.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_palette.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/money.dart';

/// Home-feed sections beyond the product rows.
///
/// The feed was five blocks deep and ran out almost immediately. These add
/// scroll depth that is still backed by real data and real destinations —
/// every tile here leads somewhere that already exists (the search endpoint,
/// the category tree, the sell flow). Nothing invents a feature.

// ══════════════════════════════════════════════════════════════════════════
// Section header
// ══════════════════════════════════════════════════════════════════════════

/// Mono eyebrow, display title, optional action. One header treatment for the
/// whole feed, so sections read as a sequence rather than a pile.
class FeedSection extends StatelessWidget {
  const FeedSection({
    required this.eyebrow,
    required this.title,
    this.accent,
    this.onSeeAll,
    super.key,
  });

  final String eyebrow;
  final String title;

  /// Set in the italic serif after [title] — one or two words at most.
  final String? accent;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eyebrow.toUpperCase(),
                  style: AppTypography.label(size: 10, color: palette.inkMuted),
                ),
                const SizedBox(height: 6),
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: title,
                        style: AppTypography.display(size: 21, color: palette.ink),
                      ),
                      if (accent != null)
                        TextSpan(
                          text: ' $accent',
                          style: AppTypography.serif(size: 21, color: palette.ink),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (onSeeAll != null)
            Pressable(
              onTap: onSeeAll,
              child: Padding(
                padding: const EdgeInsets.only(left: AppSpacing.md, bottom: 2),
                child: Row(
                  children: [
                    Text(
                      'SEE ALL',
                      style: AppTypography.label(size: 10, color: AppColors.primary),
                    ),
                    const SizedBox(width: 4),
                    const Icon(LucideIcons.arrowRight, size: 13, color: AppColors.primary),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Promise carousel
// ══════════════════════════════════════════════════════════════════════════

class _Promise {
  const _Promise(this.kicker, this.title, this.accent, this.body, this.image, this.icon);
  final String kicker;
  final String title;
  final String accent;
  final String body;
  final String image;
  final IconData icon;
}

/// Auto-advancing banner rail. Sells the platform's actual guarantees rather
/// than a discount — the things a first-time student seller needs to hear
/// before they list anything.
class PromiseCarousel extends StatefulWidget {
  const PromiseCarousel({super.key});

  @override
  State<PromiseCarousel> createState() => _PromiseCarouselState();
}

class _PromiseCarouselState extends State<PromiseCarousel> {
  static const _promises = [
    _Promise(
      'Sellers keep more',
      'Listing is',
      'free.',
      'Put up as many items as you like. You are only charged when a sale actually completes.',
      'assets/images/promise-listing.webp',
      LucideIcons.tag,
    ),
    _Promise(
      'Buyer protection',
      'Escrow on',
      'every order.',
      'Your money is held safely and only released to the seller once you confirm the item arrived.',
      'assets/images/promise-escrow.webp',
      LucideIcons.shieldCheck,
    ),
    _Promise(
      'Campus delivery',
      'Brought to your',
      'hostel.',
      'BataMart riders run deliveries across campus, with a flat zone-based fee agreed up front.',
      'assets/images/banner-delivery.webp',
      LucideIcons.bike,
    ),
    _Promise(
      'Dispute cover',
      'Raise an issue for',
      '72 hours.',
      'If something is wrong after delivery, open a dispute and track it from your orders.',
      'assets/images/promise-dispute.webp',
      LucideIcons.scale,
    ),
  ];

  final _controller = PageController(viewportFraction: 0.9);
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    // Slow enough to actually read a card before it moves on.
    _timer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || !_controller.hasClients) return;
      _controller.animateToPage(
        (_page + 1) % _promises.length,
        duration: Motion.slow,
        curve: Motion.ease,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Column(
      children: [
        SizedBox(
          height: 186,
          child: PageView.builder(
            controller: _controller,
            itemCount: _promises.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, i) {
              final p = _promises[i];
              return Padding(
                padding: EdgeInsets.only(right: i == _promises.length - 1 ? 0 : AppSpacing.md),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      KenBurns(child: AssetPhoto(p.image)),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          // Was 95%/60% black, which flattened every card
                          // to a grey slab. The photograph is the point; this
                          // only darkens enough to hold the type.
                          gradient: LinearGradient(
                            begin: Alignment.bottomLeft,
                            end: Alignment.topRight,
                            colors: [Color(0xD9131311), Color(0x40131311)],
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Row(
                              children: [
                                Icon(p.icon, size: 13, color: Colors.white.withValues(alpha: 0.7)),
                                const SizedBox(width: 6),
                                Text(
                                  p.kicker.toUpperCase(),
                                  style: AppTypography.label(
                                    size: 9,
                                    color: Colors.white.withValues(alpha: 0.7),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            RichText(
                              text: TextSpan(
                                children: [
                                  TextSpan(
                                    text: p.title,
                                    style: AppTypography.display(size: 23, color: Colors.white),
                                  ),
                                  TextSpan(
                                    text: ' ${p.accent}',
                                    style: AppTypography.serif(size: 23, color: Colors.white),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              p.body,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                height: 1.5,
                                color: Colors.white.withValues(alpha: 0.72),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < _promises.length; i++)
              AnimatedContainer(
                duration: Motion.base,
                curve: Motion.ease,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _page ? 20 : 6,
                height: 3,
                color: i == _page ? palette.ink : palette.hairline,
              ),
          ],
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Price bands
// ══════════════════════════════════════════════════════════════════════════

/// Price bands over category photography.
///
/// Students shop to a budget more than to a category. Each tile lands on the
/// Deals tab with the price filter already applied — not on a search screen
/// waiting for input.
class BudgetBands extends StatelessWidget {
  const BudgetBands({required this.onPick, super.key});

  /// Receives the ceiling in naira, and an optional category to scope it to.
  final void Function(double maxPrice, ProductCategory? category) onPick;

  static const _bands = [
    (amount: 10000, image: 'assets/images/cat-fashion.webp', label: 'Fashion'),
    (amount: 20000, image: 'assets/images/cat-electronics.webp', label: 'Tech'),
    (amount: 5000, image: 'assets/images/cat-groceries.webp', label: 'Food'),
    (amount: 30000, image: 'assets/images/cat-home.webp', label: 'Room'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const FeedSection(
          eyebrow: 'Shop to a budget',
          title: 'Everything',
          accent: 'under.',
        ),
        SizedBox(
          height: 132,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.zero,
            itemCount: _bands.length,
            separatorBuilder: (context, index) => const SizedBox(width: AppSpacing.md),
            itemBuilder: (context, i) {
              final band = _bands[i];
              return Pressable(
                scale: 0.96,
                onTap: () => onPick(band.amount.toDouble(), null),
                child: SizedBox(
                  width: 148,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        AssetPhoto(band.image),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Color(0x1A000000), Color(0xD9000000)],
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Text(
                                band.label.toUpperCase(),
                                style: AppTypography.label(
                                  size: 9,
                                  color: Colors.white.withValues(alpha: 0.7),
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'Under ${naira(band.amount)}',
                                style: AppTypography.display(size: 16, color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ).enterX(index: i);
            },
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Category spotlight
// ══════════════════════════════════════════════════════════════════════════

/// A full-bleed category panel: photograph, name, and its subcategories as
/// tappable chips over the image.
///
/// Replaces the plain text chip rails. A wall of bordered word-boxes carried
/// no more information than a list and made the feed read as a form; the
/// photograph tells you what the aisle contains before you read anything.
class CategorySpotlight extends StatelessWidget {
  const CategorySpotlight({
    required this.categoryKey,
    required this.onCategory,
    required this.onSubcategory,
    super.key,
  });

  final String categoryKey;
  final ValueChanged<ProductCategory> onCategory;
  final ValueChanged<ProductCategory> onSubcategory;

  @override
  Widget build(BuildContext context) {
    final category = productCategories.firstWhere(
      (c) => c.key == categoryKey,
      orElse: () => productCategories.first,
    );
    final subs = (productSubcategories[categoryKey] ?? const []).take(6).toList();
    // Spotlights use their own wider photography. Reusing the small
    // category-tile crops here made the same four images appear twice on one
    // screen at two different sizes.
    const spotlightImages = {
      'electronics': 'assets/images/spot-electronics.webp',
      'fashion': 'assets/images/spot-fashion.webp',
      'beauty': 'assets/images/spot-beauty.webp',
      'home_kitchen': 'assets/images/spot-home.webp',
    };
    final image = spotlightImages[categoryKey] ?? categoryImage(categoryKey);

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: SizedBox(
        height: 260,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (image != null) KenBurns(child: AssetPhoto(image)),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x40000000), Color(0x0D000000), Color(0xF2000000)],
                  stops: [0, 0.3, 1],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    'BEST SELLERS IN',
                    style: AppTypography.label(
                      size: 9,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Pressable(
                    onTap: () => onCategory(category),
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            category.label,
                            style: AppTypography.display(size: 25, color: Colors.white),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        const Icon(LucideIcons.arrowRight, size: 17, color: Colors.white),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final sub in subs)
                        Pressable(
                          scale: 0.94,
                          onTap: () => onSubcategory(sub),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.16),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                            ),
                            child: Text(
                              sub.label,
                              style: const TextStyle(fontSize: 11.5, color: Colors.white),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Closing call to action
// ══════════════════════════════════════════════════════════════════════════

/// End of the feed. Somebody who has scrolled this far is engaged; this is the
/// right moment to ask them to list something.
class SellCta extends StatelessWidget {
  const SellCta({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      scale: 0.98,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: SizedBox(
          height: 240,
          child: Stack(
            fit: StackFit.expand,
            children: [
              KenBurns(
                maxScale: 1.14,
                child: AssetPhoto('assets/images/sell-cta.webp', fit: BoxFit.cover),
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x1A131311), Color(0xE6131311)],
                    stops: [0.15, 0.92],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      'GOT SOMETHING TO SELL?',
                      style: AppTypography.label(
                        size: 10,
                        color: Colors.white.withValues(alpha: 0.65),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    RichText(
                      text: TextSpan(
                        children: [
                          TextSpan(
                            text: 'List it in',
                            style: AppTypography.display(size: 27, color: Colors.white),
                          ),
                          TextSpan(
                            text: ' two minutes.',
                            style: AppTypography.serif(size: 27, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: AppSpacing.md,
                      ),
                      color: Colors.white,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'START SELLING',
                            style: AppTypography.label(
                              size: 10,
                              color: const Color(0xFF131311),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          const Icon(LucideIcons.arrowRight, size: 14, color: Color(0xFF131311)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// [Image.asset] that says so when the file is missing.
///
/// A missing asset renders as an empty box — which is how three promise cards
/// shipped looking like bare gradients with nothing to indicate a broken
/// reference. In debug this surfaces the path; in release it degrades to the
/// page ground rather than a void.
class AssetPhoto extends StatelessWidget {
  const AssetPhoto(this.path, {this.fit = BoxFit.cover, super.key});

  final String path;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      path,
      fit: fit,
      errorBuilder: (context, error, stack) {
        assert(() {
          debugPrint('AssetPhoto: missing asset "$path"');
          return true;
        }());
        return ColoredBox(color: context.palette.card);
      },
    );
  }
}
