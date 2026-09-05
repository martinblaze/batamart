import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
// CustomTransitionPage is go_router's; the router builds every route through
// fadeThroughPage below, so the transition lives with the rest of the motion.
import 'package:go_router/go_router.dart';

/// The app's motion system.
///
/// Every animation in the product draws its timing and curve from here. That
/// single constraint is most of what separates motion that feels designed from
/// motion that feels bolted on: when durations differ by screen, the app reads
/// as several apps.
///
/// Three rules this file encodes:
///
///  1. **One curve.** [ease] is a decelerating cubic — fast to start, settling
///     rather than stopping. Everything that moves uses it.
///  2. **Nothing arrives at once.** Lists and sections stagger by [stagger],
///     capped so a long list never makes the reader wait.
///  3. **Motion is short.** 320–480ms. Longer reads as sluggish on a phone,
///     where the user is often mid-scroll already.
class Motion {
  Motion._();

  // ── Durations ─────────────────────────────────────────────────────────
  /// Taps, toggles, colour changes.
  static const fast = Duration(milliseconds: 180);

  /// The default. Entrances, reveals, most transitions.
  static const base = Duration(milliseconds: 380);

  /// Page transitions and hero flights, which cover more distance.
  static const slow = Duration(milliseconds: 480);

  /// Ambient motion — the slow drift on a banner image.
  static const ambient = Duration(seconds: 14);

  /// Delay between consecutive items in a staggered group.
  static const stagger = Duration(milliseconds: 55);

  // ── Curves ────────────────────────────────────────────────────────────
  /// The house curve. Decelerating, so things settle instead of halting.
  static const ease = Cubic(0.16, 1, 0.3, 1);

  /// For things that should overshoot very slightly — a count landing, a
  /// checkmark appearing. Used sparingly; overshoot everywhere reads as toy-like.
  static const spring = Cubic(0.34, 1.56, 0.64, 1);

  /// Symmetric, for things that both enter and leave (sheets, overlays).
  static const inOut = Curves.easeInOutCubic;

  /// Stagger delay for item [index], capped so the tail of a long list is not
  /// left waiting several seconds for its turn.
  static Duration delayFor(int index, {int cap = 8}) =>
      stagger * math.min(index, cap);
}

/// Entrance animations, as extensions so a call site reads as one line.
///
/// These run when the widget is *built*. Inside a lazy list that is equivalent
/// to a scroll-triggered reveal — items animate as they scroll into range —
/// without needing a visibility-detector dependency.
extension MotionEntrance on Widget {
  /// The default entrance: fade up a short distance. [index] staggers it
  /// against its siblings.
  Widget enter({int index = 0, double distance = 14, Duration? duration}) =>
      animate(delay: Motion.delayFor(index))
          .fadeIn(duration: duration ?? Motion.base, curve: Motion.ease)
          .slideY(
            begin: distance / 100,
            end: 0,
            duration: duration ?? Motion.base,
            curve: Motion.ease,
          );

  /// Enter from the side — used by horizontal rails, where a vertical slide
  /// would fight the direction of travel.
  Widget enterX({int index = 0, double distance = 12}) =>
      animate(delay: Motion.delayFor(index))
          .fadeIn(duration: Motion.base, curve: Motion.ease)
          .slideX(
            begin: distance / 100,
            end: 0,
            duration: Motion.base,
            curve: Motion.ease,
          );

  /// Scale up from slightly small. For things that "pop" into place — a badge,
  /// a confirmation mark.
  Widget pop({int index = 0}) => animate(delay: Motion.delayFor(index))
      .fadeIn(duration: Motion.fast, curve: Motion.ease)
      .scaleXY(begin: 0.94, end: 1, duration: Motion.base, curve: Motion.spring);
}

/// Wraps a tappable thing so it takes a small, immediate depth on press.
///
/// This is the single highest-value micro-interaction in the app: it is the
/// difference between a button that responds and one that merely navigates.
/// The scale-down is fast (the finger is already down) and the release settles
/// on the house curve.
class Pressable extends StatefulWidget {
  const Pressable({
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = 0.97,
    this.behavior = HitTestBehavior.opaque,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// How far it sinks. Large surfaces (a full-width card) want less than a
  /// small one, or the movement reads as a wobble.
  final double scale;
  final HitTestBehavior behavior;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    return GestureDetector(
      behavior: widget.behavior,
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      onTapDown: enabled ? (_) => _set(true) : null,
      onTapUp: enabled ? (_) => _set(false) : null,
      onTapCancel: enabled ? () => _set(false) : null,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: _down ? Motion.fast : Motion.base,
        curve: Motion.ease,
        child: widget.child,
      ),
    );
  }
}

/// A number that counts up to its value instead of appearing at it.
///
/// Used for prices, order totals and stat figures. [format] keeps currency and
/// thousands separators the caller's business, so this widget never has to know
/// about locale.
class CountUp extends StatelessWidget {
  const CountUp({
    required this.value,
    required this.format,
    this.style,
    this.duration,
    super.key,
  });

  final num value;
  final String Function(num) format;
  final TextStyle? style;
  final Duration? duration;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: duration ?? Motion.slow,
      curve: Motion.ease,
      builder: (context, v, child) => Text(format(v), style: style),
    );
  }
}

/// Slow, continuous drift over a still image — the "Ken Burns" effect.
///
/// Gives a photograph life without asking anyone to ship video. The movement is
/// deliberately near-imperceptible; if you can see it happening, it is too fast.
/// Honours the platform's reduce-motion setting.
class KenBurns extends StatefulWidget {
  const KenBurns({
    required this.child,
    this.duration,
    this.maxScale = 1.09,
    this.alignment = Alignment.center,
    super.key,
  });

  final Widget child;
  final Duration? duration;
  final double maxScale;
  final Alignment alignment;

  @override
  State<KenBurns> createState() => _KenBurnsState();
}

class _KenBurnsState extends State<KenBurns> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration ?? Motion.ambient,
  );

  @override
  void initState() {
    super.initState();
    _c.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (_, child) => Transform.scale(
        scale: 1 + (widget.maxScale - 1) * Curves.easeInOut.transform(_c.value),
        alignment: widget.alignment,
        child: child,
      ),
      child: widget.child,
    );
  }
}

/// Moves [child] against the scroll at a fraction of the scroll distance.
///
/// Wrap a header image in this and it drifts more slowly than the content over
/// it, which is what reads as depth. [factor] above ~0.4 starts to look like a
/// bug rather than a parallax.
class ParallaxBox extends StatelessWidget {
  const ParallaxBox({
    required this.scrollable,
    required this.child,
    this.factor = 0.28,
    super.key,
  });

  final ScrollController scrollable;
  final Widget child;
  final double factor;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: scrollable,
      builder: (_, c) {
        final offset = scrollable.hasClients ? scrollable.offset : 0.0;
        return Transform.translate(
          offset: Offset(0, offset * factor),
          child: c,
        );
      },
      child: child,
    );
  }
}

/// Page transition used by the router: a short fade married to a small upward
/// slide. Deliberately restrained — a full slide-across on every push makes an
/// app feel slow once you have used it more than twice.
CustomTransitionPage<T> fadeThroughPage<T>({
  required Widget child,
  required LocalKey key,
  String? name,
}) {
  return CustomTransitionPage<T>(
    key: key,
    name: name,
    child: child,
    transitionDuration: Motion.base,
    reverseTransitionDuration: Motion.fast,
    transitionsBuilder: (context, animation, secondary, c) {
      final curved = CurvedAnimation(parent: animation, curve: Motion.ease);
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween(
            begin: const Offset(0, 0.015),
            end: Offset.zero,
          ).animate(curved),
          child: c,
        ),
      );
    },
  );
}
