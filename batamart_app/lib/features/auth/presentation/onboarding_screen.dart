import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';

/// Matches the collage's second onboarding frame: logo, "Everything you
/// need, delivered.", "Get Started" (-> Signup) / "I already have an
/// account" (-> Login).
class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            children: [
              const Spacer(flex: 3),
              Image.asset('assets/branding/batamart_wordmark.png', height: 56),
              const Spacer(flex: 2),
              const Text(
                'Everything you need,\ndelivered.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
              ),
              const Spacer(flex: 3),
              PrimaryButton(
                label: 'Get Started',
                onPressed: () => context.push(AppRoutes.signup),
              ),
              const SizedBox(height: AppSpacing.md),
              SecondaryButton(
                label: 'I already have an account',
                onPressed: () => context.push(AppRoutes.login),
              ),
              const SizedBox(height: AppSpacing.lg),
              TextButton(
                onPressed: () => context.push(AppRoutes.riderLogin),
                child: const Text('Sign in as a Rider instead'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
