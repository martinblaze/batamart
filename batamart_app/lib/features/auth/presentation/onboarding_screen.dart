import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/motion/motion.dart';

/// Matches the collage's second onboarding frame: logo, "Everything you
/// need, delivered.", "Get Started" (-> Signup) / "I already have an
/// account" (-> Login).
class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Full-bleed campus photography, drifting slowly. The whole screen
          // is the image; the copy and actions sit on a scrim over its foot.
          KenBurns(
            maxScale: 1.12,
            child: Image.asset(
              'assets/images/banner-campus.webp',
              fit: BoxFit.cover,
            ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x99000000), Color(0x40000000), Color(0xF2000000)],
                stops: [0, 0.35, 0.82],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: AppSpacing.lg),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Image.asset(
                      'assets/branding/batamart_wordmark.png',
                      height: 30,
                      color: Colors.white,
                    ),
                  ).enter(index: 0),
                  const Spacer(),
                  Text(
                    'CAMPUS MARKETPLACE',
                    style: AppTypography.label(
                      size: 10,
                      color: Colors.white.withValues(alpha: 0.6),
                    ),
                  ).enter(index: 1),
                  const SizedBox(height: AppSpacing.md),
                  RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: 'Everything you need,',
                          style: AppTypography.display(size: 38, color: Colors.white),
                        ),
                        TextSpan(
                          text: '\ndelivered.',
                          style: AppTypography.serif(size: 38, color: Colors.white),
                        ),
                      ],
                    ),
                  ).enter(index: 2),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'Buy and sell with students on your campus — with escrow on every order.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.72),
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ).enter(index: 3),
                  const SizedBox(height: AppSpacing.xl),
                  // PrimaryButton fills with ink, which is invisible against
                  // this scrim — on a dark ground the primary action inverts.
                  Pressable(
                    onTap: () => context.push(AppRoutes.signup),
                    child: Container(
                      height: 54,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Text(
                        'GET STARTED',
                        style: AppTypography.label(
                          size: 11,
                          color: const Color(0xFF131311),
                        ),
                      ),
                    ),
                  ).enter(index: 4),
                  const SizedBox(height: AppSpacing.md),
                  Pressable(
                    onTap: () => context.push(AppRoutes.login),
                    child: Container(
                      height: 52,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
                        borderRadius: BorderRadius.circular(AppRadii.md),
                      ),
                      child: Text(
                        'I ALREADY HAVE AN ACCOUNT',
                        style: AppTypography.label(size: 10, color: Colors.white),
                      ),
                    ),
                  ).enter(index: 5),
                  const SizedBox(height: AppSpacing.lg),
                  Center(
                    child: Pressable(
                      onTap: () => context.push(AppRoutes.riderLogin),
                      child: Text(
                        'Sign in as a Rider instead',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.65),
                          fontSize: 13,
                          decoration: TextDecoration.underline,
                          decorationColor: Colors.white24,
                        ),
                      ),
                    ),
                  ).enter(index: 6),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
