import 'package:flutter/material.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/editorial.dart';

/// Held only while [AuthController] bootstraps — reading the stored token and
/// calling `me()`. The router redirects away the instant that resolves (see
/// `app_router.dart`), so this is a held brand moment, not a loading screen:
/// the spinner is deliberately a thin hairline bar rather than a throbber.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Scaffold(
      backgroundColor: p.page,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(flex: 2),
              Image.asset(
                'assets/branding/batamart_icon.png',
                width: 64,
                height: 64,
              ),
              const SizedBox(height: AppSpacing.xl),
              Text.rich(
                TextSpan(
                  text: 'Everything you need,',
                  style: AppTypography.display(size: 34, color: p.ink),
                  children: [
                    TextSpan(
                      text: ' delivered',
                      style: AppTypography.serif(size: 36, color: p.ink),
                    ),
                    TextSpan(
                      text: '.',
                      style: AppTypography.display(size: 34, color: p.ink),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'The campus marketplace, in your pocket.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: p.inkSecondary,
                ),
              ),
              const Spacer(flex: 3),
              const Eyebrow('Loading'),
              const SizedBox(height: AppSpacing.md),
              // A determinate-looking hairline reads calmer than a spinner for
              // something that resolves in a few hundred milliseconds.
              SizedBox(
                height: 2,
                child: LinearProgressIndicator(
                  backgroundColor: p.hairline,
                  color: p.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
