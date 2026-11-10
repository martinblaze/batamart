import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/states/loading_skeleton.dart';
import '../../marketplace/presentation/widgets/home_sections.dart';
import '../../wishlist/presentation/wishlist_heart.dart';
import '../data/promo_models.dart';
import '../data/promos_repository.dart';

/// Formats a remaining duration as "5h 20m" / "42m" / "<1m".
String formatCountdown(Duration d) {
  if (d.inMinutes < 1) return '<1m';
  final h = d.inHours;
  final m = d.inMinutes % 60;
  return h > 0 ? '${h}h ${m}m' : '${m}m';
}

/// "Wednesday" from an ISO date, else null.
String? _weekday(String? iso) {
  final d = DateTime.tryParse(iso ?? '');
  return d == null ? null : DateFormat('EEEE').format(d.toLocal());
}

// ═════════════════════════════════════════════════════════════════════════
// Top strip: delivery countdown + just-ordered ticker
// ═════════════════════════════════════════════════════════════════════════

class LiveTopStrip extends ConsumerWidget {
  const LiveTopStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(promosHomeProvider);
    final live = async.asData?.value.live;

    if (live == null) {
      // First load only; an error already resolved to an empty payload.
      return async.isLoading
          ? const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.lg),
              child: LoadingSkeleton(height: 44),
            )
          : const SizedBox.shrink();
    }

    final children = <Widget>[
      if (live.delivery != null) _DeliveryCountdown(delivery: live.delivery!),
      if (live.justOrdered.isNotEmpty) _JustOrderedTicker(items: live.justOrdered),
    ];
    if (children.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md),
      child: Column(
        children: [
          for (final (i, c) in children.indexed) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            c,
          ],
        ],
      ).enter(),
    );
  }
}

class _DeliveryCountdown extends StatefulWidget {
  const _DeliveryCountdown({required this.delivery});
  final LiveDelivery delivery;

  @override
  State<_DeliveryCountdown> createState() => _DeliveryCountdownState();
}

class _DeliveryCountdownState extends State<_DeliveryCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Minute precision is all the copy shows, so a 15 s tick is plenty.
    _timer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.delivery.cutoffAt.difference(DateTime.now());
    if (left <= Duration.zero) return const SizedBox.shrink();

    final p = context.palette;
    final day = _weekday(widget.delivery.nextDeliveryDate);
    final dest = day != null
        ? '$day delivery'
        : (widget.delivery.label.isNotEmpty ? widget.delivery.label : 'delivery');

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: p.hairline),
      ),
      child: Row(
        children: [
          Icon(LucideIcons.clock, size: 16, color: p.ink),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Order within '),
                  TextSpan(
                    text: formatCountdown(left),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  TextSpan(text: ' for $dest'),
                ],
              ),
              style: TextStyle(fontSize: 13, color: p.ink),
            ),
          ),
        ],
      ),
    );
  }
}

class _JustOrderedTicker extends StatefulWidget {
  const _JustOrderedTicker({required this.items});
  final List<JustOrdered> items;

  @override
  State<_JustOrderedTicker> createState() => _JustOrderedTickerState();
}

class _JustOrderedTickerState extends State<_JustOrderedTicker> {
  Timer? _timer;
  int _i = 0;

  @override
  void initState() {
    super.initState();
    if (widget.items.length > 1) {
      _timer = Timer.periodic(const Duration(seconds: 4), (_) {
        if (mounted) setState(() => _i = (_i + 1) % widget.items.length);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _ago(int m) => m <= 1
      ? 'just now'
      : m < 60
      ? '$m min ago'
      : '${m ~/ 60}h ago';

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final reduce = MediaQuery.disableAnimationsOf(context);
    final item = widget.items[_i % widget.items.length];

    final row = Row(
      key: ValueKey(_i),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.sm),
          child: SizedBox(
            width: 32,
            height: 32,
            child: item.imageUrl == null
                ? Container(color: p.page)
                : AppNetworkImage(item.imageUrl!, width: 32, height: 32),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            'Someone just ordered ${item.productName}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: p.ink),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          _ago(item.minutesAgo),
          style: AppTypography.label(size: 9, color: p.inkMuted),
        ),
      ],
    );

    return SizedBox(
      height: 36,
      child: reduce
          ? row
          : AnimatedSwitcher(
              duration: Motion.base,
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0, 0.4),
                    end: Offset.zero,
                  ).animate(anim),
                  child: child,
                ),
              ),
              child: row,
            ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Rails: trending, price drops, new today
// ═════════════════════════════════════════════════════════════════════════

class LiveRails extends ConsumerWidget {
  const LiveRails({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(promosHomeProvider);
    final live = async.asData?.value.live;

    if (live == null) {
      return async.isLoading ? const _RailSkeleton() : const SizedBox.shrink();
    }

    final rails = <Widget>[
      if (live.trending.isNotEmpty)
        _LiveRail(
          eyebrow: 'Selling fast',
          title: 'Trending',
          accent: 'now.',
          products: live.trending,
        ),
      if (live.priceDrops.isNotEmpty)
        _LiveRail(
          eyebrow: 'Cheaper than before',
          title: 'Price',
          accent: 'drops.',
          products: live.priceDrops,
        ),
      if (live.newToday.isNotEmpty)
        _LiveRail(
          eyebrow: 'Listed in the last day',
          title: 'New',
          accent: 'today.',
          products: live.newToday,
        ),
    ];
    if (rails.isEmpty) return const SizedBox.shrink();

    return Column(children: rails);
  }
}

class _LiveRail extends StatelessWidget {
  const _LiveRail({
    required this.eyebrow,
    required this.title,
    required this.accent,
    required this.products,
  });

  final String eyebrow;
  final String title;
  final String accent;
  final List<LiveProduct> products;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.section),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FeedSection(eyebrow: eyebrow, title: title, accent: accent),
          SizedBox(
            height: 320,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.lg),
              itemBuilder: (context, index) {
                final x = products[index];
                final hasWas = x.originalPrice != null && x.originalPrice! > x.price;
                return SizedBox(
                  width: 150,
                  child: ProductCard(
                    imageUrl: x.image,
                    name: x.name,
                    price: naira(x.price),
                    originalPrice: hasWas ? naira(x.originalPrice!) : null,
                    percentOff: (x.discountPercent ?? 0) > 0
                        ? x.discountPercent
                        : null,
                    category: x.category,
                    location: x.sellerName,
                    favorite: WishlistHeart(productId: x.id),
                    onTap: () {
                      Haptics.tap();
                      context.push(AppRoutes.productDetailPath(x.id));
                    },
                  ),
                ).enterX(index: index);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _RailSkeleton extends StatelessWidget {
  const _RailSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.section),
      child: SizedBox(
        height: 250,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 3,
          separatorBuilder: (context, index) =>
              const SizedBox(width: AppSpacing.lg),
          itemBuilder: (context, index) =>
              const SizedBox(width: 150, child: ProductCardSkeleton()),
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Stats line
// ═════════════════════════════════════════════════════════════════════════

class LiveStatsLine extends ConsumerWidget {
  const LiveStatsLine({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(promosHomeProvider).asData?.value.live.stats;
    if (stats == null || stats.isEmpty) return const SizedBox.shrink();

    final fmt = NumberFormat.decimalPattern();
    final parts = <String>[
      if ((stats.ordersThisWeek ?? 0) > 0)
        '${fmt.format(stats.ordersThisWeek)} orders this week',
      if ((stats.activeShoppersToday ?? 0) > 0)
        '${fmt.format(stats.activeShoppersToday)} shoppers active today',
    ];
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.section),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.activity, size: 13, color: p.inkMuted),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              parts.join('  |  '),
              textAlign: TextAlign.center,
              style: AppTypography.label(size: 10, color: p.inkSecondary),
            ),
          ),
        ],
      ),
    ).enter();
  }
}
