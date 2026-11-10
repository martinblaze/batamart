import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../data/promo_models.dart';
import '../data/promos_repository.dart';
import '../state/promo_frequency.dart';
import '../state/promo_frequency_store.dart';
import 'promo_links.dart';

/// Wraps the buyer home and, about 1.5 s after it loads, opens the rotating
/// promo sheet if the frequency rules allow. Fails silently on any error.
class PromoSheetHost extends ConsumerStatefulWidget {
  const PromoSheetHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PromoSheetHost> createState() => _PromoSheetHostState();
}

class _PromoSheetHostState extends ConsumerState<PromoSheetHost> {
  Timer? _timer;
  bool _attempted = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 1500), _maybeShow);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _maybeShow() async {
    if (_attempted || !mounted) return;
    _attempted = true;
    try {
      final home = await ref.read(promosHomeProvider.future);
      if (!mounted || home.popups.isEmpty) return;

      final store = PromoFrequencyStore();
      final state = await store.load();
      final now = DateTime.now().millisecondsSinceEpoch;
      if (!PromoFrequency.canShow(state, now)) return;
      final slides = PromoFrequency.pickSlides<PromoPopup>(
        state,
        home.popups,
        (p) => p.kind,
        now,
      );
      if (slides.isEmpty || !mounted) return;

      // Never over auth/checkout/payment, and only if home is the screen the
      // user is actually looking at (not a pushed route or another sheet).
      final route = ModalRoute.of(context);
      if (route != null && !route.isCurrent) return;
      final path = GoRouter.of(context).routeInformationProvider.value.uri.path;
      if (PromoFrequency.isBlockedPath(path)) return;

      await store.save(PromoFrequency.recordShown(state, now));
      if (!mounted) return;
      final viewed = await showModalBottomSheet<Set<String>>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => PromoSheet(slides: slides),
      );
      if (viewed != null && viewed.isNotEmpty) {
        final fresh = await store.load();
        await store.save(
          PromoFrequency.dismissKinds(
            fresh,
            viewed,
            DateTime.now().millisecondsSinceEpoch,
          ),
        );
      }
    } catch (_) {
      // Promos are decoration; never surface an error.
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// The sheet itself. Pops with the set of slide kinds the user dismissed (empty
/// when they followed a CTA, so that kind is not suppressed).
class PromoSheet extends StatefulWidget {
  const PromoSheet({super.key, required this.slides});

  final List<PromoPopup> slides;

  @override
  State<PromoSheet> createState() => _PromoSheetState();
}

class _PromoSheetState extends State<PromoSheet>
    with SingleTickerProviderStateMixin {
  static const _slideDuration = Duration(seconds: 5);

  late final AnimationController _progress = AnimationController(
    vsync: this,
    duration: _slideDuration,
  )..addStatusListener(_onStatus);
  final PageController _pages = PageController();
  int _index = 0;
  int _maxSeen = 0;
  bool _reduceMotion = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (!_started) {
      _started = true;
      _restart();
    }
    if (_reduceMotion) _progress.stop();
  }

  @override
  void dispose() {
    _progress.dispose();
    _pages.dispose();
    super.dispose();
  }

  void _restart() {
    _progress.reset();
    if (!_reduceMotion && widget.slides.length > 1) _progress.forward();
  }

  void _onStatus(AnimationStatus s) {
    if (s != AnimationStatus.completed || !mounted) return;
    final next = (_index + 1) % widget.slides.length;
    _pages.animateToPage(
      next,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  void _pause() {
    if (_progress.isAnimating) _progress.stop();
  }

  void _resume() {
    if (_reduceMotion || widget.slides.length < 2) return;
    if (!_progress.isAnimating && _progress.value < 1) _progress.forward();
  }

  void _close() {
    final seen = {
      for (var i = 0; i <= _maxSeen && i < widget.slides.length; i++)
        widget.slides[i].kind,
    };
    Navigator.of(context).pop(seen);
  }

  void _cta(PromoPopup slide) {
    Haptics.tap();
    final router = GoRouter.of(context);
    final nav = Navigator.of(context);
    nav.pop(<String>{});
    final target = resolvePromoUrl(slide.ctaUrl);
    // Navigate after the sheet closes so the new route is not pushed beneath it.
    if (target == null || target.path == AppRoutes.home) {
      router.go(AppRoutes.home, extra: target?.tab);
    } else {
      router.push(target.path);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final slides = widget.slides;
    final slide = slides[_index];

    return Listener(
      onPointerDown: (_) => _pause(),
      onPointerUp: (_) => _resume(),
      onPointerCancel: (_) => _resume(),
      child: Container(
        decoration: BoxDecoration(
          color: p.card,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: AnimatedBuilder(
                        animation: _progress,
                        builder: (context, _) => Row(
                          children: [
                            for (var i = 0; i < slides.length; i++)
                              Expanded(
                                child: Padding(
                                  padding: EdgeInsets.only(
                                    right: i == slides.length - 1 ? 0 : 4,
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(2),
                                    child: LinearProgressIndicator(
                                      minHeight: 3,
                                      value: i < _index
                                          ? 1
                                          : i == _index
                                          ? (_reduceMotion
                                                ? 1
                                                : _progress.value)
                                          : 0,
                                      backgroundColor: p.hairline,
                                      valueColor: AlwaysStoppedAnimation(p.ink),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Close',
                      icon: const Icon(LucideIcons.x, size: 20),
                      onPressed: _close,
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: 340,
                child: PageView.builder(
                  controller: _pages,
                  itemCount: slides.length,
                  onPageChanged: (i) {
                    setState(() {
                      _index = i;
                      if (i > _maxSeen) _maxSeen = i;
                    });
                    _restart();
                  },
                  itemBuilder: (context, i) => _SlideBody(slide: slides[i]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => _cta(slide),
                    child: Text(slide.ctaLabel),
                  ),
                ),
              ),
              TextButton(
                onPressed: _close,
                child: Text('Not now', style: TextStyle(color: p.inkSecondary)),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}

class _SlideBody extends StatelessWidget {
  const _SlideBody({required this.slide});

  final PromoPopup slide;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.md),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (slide.imageUrl != null)
                    AppNetworkImage(slide.imageUrl!, fit: BoxFit.cover)
                  else
                    Container(
                      color: p.page,
                      alignment: Alignment.center,
                      child: Icon(LucideIcons.sparkles,
                          size: 36, color: p.inkMuted),
                    ),
                  if (slide.badge != null)
                    Positioned(
                      top: AppSpacing.sm,
                      left: AppSpacing.sm,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 5),
                        color: AppColors.danger,
                        child: Text(
                          slide.badge!.toUpperCase(),
                          style: AppTypography.label(
                              size: 10, color: Colors.white),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            slide.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.display(size: 20, weight: FontWeight.w700),
          ),
          if (slide.body.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              slide.body,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: p.inkSecondary, fontSize: 13, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }
}
