import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../auth/state/auth_controller.dart';
import '../state/wishlist_providers.dart';

/// Toggles [productId] in the wishlist. Shared by cards and the product page.
Future<void> toggleWishlist(
  BuildContext context,
  WidgetRef ref,
  String productId,
) async {
  if (!ref.read(authControllerProvider).isAuthenticated) {
    context.push(AppRoutes.login);
    return;
  }
  Haptics.tap();
  final messenger = ScaffoldMessenger.maybeOf(context);
  final result = await ref.read(wishlistIdsProvider.notifier).toggle(productId);
  if (result == null) {
    messenger?.showSnackBar(
      const SnackBar(content: Text('Could not update your wishlist. Try again.')),
    );
    return;
  }
  ref.invalidate(wishlistItemsProvider);
}

/// Small round heart for the corner of a product card. Reads the single shared
/// ids set, so it costs nothing per card.
class WishlistHeart extends ConsumerWidget {
  const WishlistHeart({super.key, required this.productId, this.onDark = false});

  final String productId;

  /// Draws on a dark scrim (the product page hero) instead of a light pill.
  final bool onDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(
      wishlistIdsProvider.select((ids) => ids.contains(productId)),
    );
    final p = context.palette;
    final color = saved
        ? AppColors.danger
        : (onDark ? Colors.white : p.inkSecondary);

    return Semantics(
      button: true,
      label: saved ? 'Remove from wishlist' : 'Save to wishlist',
      child: Pressable(
        onTap: () => toggleWishlist(context, ref, productId),
        scale: 0.85,
        child: Container(
          width: onDark ? 38 : 28,
          height: onDark ? 38 : 28,
          decoration: BoxDecoration(
            color: onDark
                ? Colors.black.withValues(alpha: 0.38)
                : p.card.withValues(alpha: 0.92),
            shape: BoxShape.circle,
          ),
          child: AnimatedSwitcher(
            duration: Motion.fast,
            transitionBuilder: (child, anim) =>
                ScaleTransition(scale: anim, child: child),
            child: Icon(
              saved ? Icons.favorite : LucideIcons.heart,
              key: ValueKey(saved),
              size: onDark ? 17 : 14,
              color: color,
            ),
          ),
        ),
      ),
    );
  }
}
