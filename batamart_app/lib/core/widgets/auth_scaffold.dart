import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../motion/motion.dart';
import '../theme/app_palette.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';

/// The shared frame for every authentication screen.
///
/// The old auth screens were a heading and a stack of fields on an empty
/// ground — the same layout a form generator would produce, and the reason the
/// first thing a new user saw felt unfinished.
///
/// The frame here does three things:
///
///  * **Gives the screen a subject.** A photograph fills the top third, so the
///    app has something to say before it asks for an email address.
///  * **Collapses on scroll.** The image is a [SliverAppBar], so bringing up
///    the keyboard and scrolling shrinks the photo into a compact bar instead
///    of shoving the form off-screen. This is what makes the parallax feel
///    like a behaviour rather than a decoration.
///  * **Keeps text legible over photography.** A two-stop scrim sits between
///    image and type. Never place auth copy directly on a photo — the contrast
///    is unpredictable across devices and images.
class AuthScaffold extends StatefulWidget {
  const AuthScaffold({
    required this.image,
    required this.eyebrow,
    required this.title,
    required this.children,
    this.titleAccent,
    this.subtitle,
    this.onBack,
    this.footer,
    super.key,
  });

  /// Asset path for the hero photograph.
  final String image;

  /// Mono kicker above the title.
  final String eyebrow;

  /// Display title. [titleAccent] is set in the italic serif directly after it
  /// — the house treatment for emphasis, rationed to one or two words.
  final String title;
  final String? titleAccent;
  final String? subtitle;

  /// Form content. Already padded and in a column.
  final List<Widget> children;

  final VoidCallback? onBack;
  final Widget? footer;

  @override
  State<AuthScaffold> createState() => _AuthScaffoldState();
}

class _AuthScaffoldState extends State<AuthScaffold> {
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final media = MediaQuery.of(context);

    // The hero yields height when the keyboard is up, so a focused field is
    // never hidden behind it on a short device.
    final keyboardUp = media.viewInsets.bottom > 120;
    final heroHeight = keyboardUp
        ? 132.0
        : (media.size.height * 0.38).clamp(240.0, 340.0);

    return Scaffold(
      backgroundColor: palette.page,
      body: CustomScrollView(
        controller: _scroll,
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverAppBar(
            expandedHeight: heroHeight,
            collapsedHeight: 64,
            pinned: true,
            stretch: true,
            automaticallyImplyLeading: false,
            backgroundColor: palette.page,
            surfaceTintColor: Colors.transparent,
            leading: widget.onBack == null
                ? null
                : Padding(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    child: Pressable(
                      onTap: widget.onBack,
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.35),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          LucideIcons.arrowLeft,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
            flexibleSpace: FlexibleSpaceBar(
              stretchModes: const [StretchMode.zoomBackground],
              background: _Hero(
                image: widget.image,
                eyebrow: widget.eyebrow,
                title: widget.title,
                titleAccent: widget.titleAccent,
                subtitle: widget.subtitle,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Container(
              // Pulled up over the photograph so the form overlaps it — the
              // overlap is what makes the two read as one composition.
              transform: Matrix4.translationValues(0, -18, 0),
              decoration: BoxDecoration(
                color: palette.page,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadii.xl),
                ),
              ),
              padding: EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.xl,
                AppSpacing.xl,
                AppSpacing.xl + media.viewInsets.bottom * 0.15,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ...widget.children,
                  if (widget.footer != null) ...[
                    const SizedBox(height: AppSpacing.xl),
                    widget.footer!,
                  ],
                  SizedBox(height: media.padding.bottom + AppSpacing.lg),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({
    required this.image,
    required this.eyebrow,
    required this.title,
    this.titleAccent,
    this.subtitle,
  });

  final String image;
  final String eyebrow;
  final String title;
  final String? titleAccent;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        KenBurns(child: Image.asset(image, fit: BoxFit.cover)),
        // Two stops, not one: a light wash over the whole frame lifts contrast
        // everywhere, and a heavier foot anchors the type.
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x33000000), Color(0x14000000), Color(0xE6000000)],
              stops: [0, 0.42, 1],
            ),
          ),
        ),
        Positioned(
          left: AppSpacing.xl,
          right: AppSpacing.xl,
          bottom: AppSpacing.xl + 12,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                eyebrow.toUpperCase(),
                style: AppTypography.label(
                  size: 10,
                  color: Colors.white.withValues(alpha: 0.65),
                ),
              ).enter(index: 0),
              const SizedBox(height: AppSpacing.sm),
              RichText(
                text: TextSpan(
                  children: [
                    TextSpan(
                      text: title,
                      style: AppTypography.display(size: 34, color: Colors.white),
                    ),
                    if (titleAccent != null)
                      TextSpan(
                        text: ' $titleAccent',
                        style: AppTypography.serif(size: 34, color: Colors.white),
                      ),
                  ],
                ),
              ).enter(index: 1),
              if (subtitle != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  subtitle!,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.78),
                    fontSize: 14,
                    height: 1.45,
                  ),
                ).enter(index: 2),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Step rule for multi-step auth flows.
///
/// Reads as an instrument rather than a wizard: filled segments for the steps
/// behind you, a mono counter on the right. Knowing a flow is two steps long
/// before starting it is most of what makes it feel short.
class AuthSteps extends StatelessWidget {
  const AuthSteps({required this.current, required this.total, super.key});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Row(
        children: [
          for (var i = 0; i < total; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AnimatedContainer(
                duration: Motion.slow,
                curve: Motion.ease,
                height: 3,
                color: i < current ? palette.ink : palette.hairline,
              ),
            ),
          ],
          const SizedBox(width: AppSpacing.md),
          Text(
            '${current.toString().padLeft(2, '0')}/${total.toString().padLeft(2, '0')}',
            style: AppTypography.label(size: 10, color: palette.inkMuted),
          ),
        ],
      ),
    );
  }
}
