import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Matches the collage's "Logo splash" frame ("Everything you need,
/// delivered."). Shown only while [AuthController] bootstraps (reading the
/// stored token and calling `me()`) — the router redirects away the
/// instant that resolves (see `app_router.dart`).
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/branding/batamart_icon.png',
              width: 96,
              height: 96,
            ),
            const SizedBox(height: 24),
            ShaderMask(
              shaderCallback: (bounds) =>
                  AppColors.brandGradient.createShader(bounds),
              child: const Text(
                'BataMart',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Everything you need, delivered.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 40),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
