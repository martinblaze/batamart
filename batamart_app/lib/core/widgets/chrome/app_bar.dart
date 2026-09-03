import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Standard screen app bar — back chevron (when [showBack]), title, and up
/// to two trailing actions (e.g. Wallet's edit icon, Notifications'
/// "Mark all as read"). Styling comes from `AppBarTheme` in [AppTheme].
class BataAppBar extends StatelessWidget implements PreferredSizeWidget {
  const BataAppBar({
    super.key,
    required this.title,
    this.showBack = false,
    this.onBack,
    this.actions,
  });

  final String title;
  final bool showBack;
  final VoidCallback? onBack;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      leading: showBack
          ? IconButton(
              tooltip: 'Back',
              icon: const Icon(LucideIcons.arrowLeft),
              onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            )
          : null,
      automaticallyImplyLeading: showBack,
      actions: actions,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
