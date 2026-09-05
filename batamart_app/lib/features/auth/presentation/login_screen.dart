import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/motion/motion.dart';
import '../../../core/widgets/auth_scaffold.dart';
import '../../../core/api/auth_error_message.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../data/auth_models.dart';
import '../state/auth_controller.dart';

/// Matches the collage's "Welcome Back" frame. Note: the mockup's field
/// says "Email or Phone", but `POST /api/auth/login-with-password` only
/// accepts `{ email, password }` (BACKEND_REFERENCE.md §3.1) — there's no
/// phone-based password login route. Labeled "Email" here to match what
/// actually works; flagged back per CLAUDE.md's "trust the API over a
/// stale assumption" rule.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .loginWithPassword(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      // On success the router's redirect guard takes over automatically.
    } on ApiException catch (e) {
      setState(() => _error = formatAuthErrorMessage(e));
    } catch (e) {
      // Anything that isn't an ApiException (secure-storage write failure,
      // a me() refresh hiccup, etc.) used to fail silently here — the
      // `finally` below reset the spinner with zero explanation, which is
      // indistinguishable from "nothing happened" from the user's side.
      if (mounted) setState(() => _error = 'Login failed: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _continueWithGoogle() async {
    setState(() {
      _isGoogleLoading = true;
      _error = null;
    });
    try {
      final outcome = await ref
          .read(authControllerProvider.notifier)
          .continueWithGoogle();
      if (outcome is GoogleSignupRequired && mounted) {
        context.push(AppRoutes.signup, extra: outcome);
      }
      // GoogleAuthSuccess: router redirect takes over automatically.
    } on GoogleSignInException catch (e) {
      if (e.code != GoogleSignInExceptionCode.canceled) {
        setState(() => _error = 'Google sign-in failed: ${e.description}');
      }
    } on ApiException catch (e) {
      setState(() => _error = formatAuthErrorMessage(e));
    } catch (e) {
      // Catches TimeoutException and anything else GoogleAuthService can
      // throw that isn't a GoogleSignInException/ApiException — without
      // this, an unrecognized failure mode leaves the button stuck on its
      // loading spinner with no explanation (see google_auth_service.dart).
      if (mounted) setState(() => _error = 'Google sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _isGoogleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return AuthScaffold(
      image: 'assets/images/auth-hero.webp',
      eyebrow: 'Account',
      title: 'Welcome',
      titleAccent: 'back.',
      subtitle: 'Log in to pick up where you left off.',
      onBack: () => context.pop(),
      children: [
        AppTextField(
          controller: _emailController,
          label: 'Email',
          keyboardType: TextInputType.emailAddress,
          prefixIcon: LucideIcons.mail,
        ).enter(index: 0),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          controller: _passwordController,
          label: 'Password',
          obscureText: _obscurePassword,
          prefixIcon: LucideIcons.lock,
          suffixIcon: IconButton(
            tooltip: _obscurePassword ? 'Show password' : 'Hide password',
            icon: Icon(
              _obscurePassword ? LucideIcons.eyeOff : LucideIcons.eye,
              size: 18,
            ),
            onPressed: () =>
                setState(() => _obscurePassword = !_obscurePassword),
          ),
        ).enter(index: 1),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => context.push(AppRoutes.forgotPassword),
            child: Text('Forgot password?', style: AppTypography.label(size: 10)),
          ),
        ).enter(index: 2),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          _ErrorNote(_error!).enter(),
        ],
        const SizedBox(height: AppSpacing.md),
        PrimaryButton(
          label: 'Log in',
          onPressed: _submit,
          isLoading: _isLoading,
        ).enter(index: 3),
        const SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            Expanded(child: Divider(color: palette.hairline)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Text(
                'OR CONTINUE WITH',
                style: AppTypography.label(size: 10, color: palette.inkMuted),
              ),
            ),
            Expanded(child: Divider(color: palette.hairline)),
          ],
        ).enter(index: 4),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: _SocialButton(
                label: 'Google',
                mark: 'G',
                isLoading: _isGoogleLoading,
                onTap: _isGoogleLoading ? null : _continueWithGoogle,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _SocialButton(
                label: 'Facebook',
                mark: 'f',
                onTap: () =>
                    _showGoogleSignInStub(context, provider: 'Facebook'),
              ),
            ),
          ],
        ).enter(index: 5),
        const SizedBox(height: AppSpacing.xl),
        Center(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                "Don't have an account? ",
                style: TextStyle(color: palette.inkSecondary, fontSize: 14),
              ),
              Pressable(
                onTap: () => context.push(AppRoutes.signup),
                child: const Text(
                  'Sign up',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ).enter(index: 6),
      ],
    );
  }

  void _showGoogleSignInStub(
    BuildContext context, {
    String provider = 'Google',
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '$provider Sign-In needs an Android OAuth client ID — see README "Phase 3 status".',
        ),
      ),
    );
  }
}

/// Outlined, mono-labelled, and pressable — the same tactile treatment the
/// primary action gets, so a secondary path doesn't feel like a dead end.
class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.mark,
    required this.onTap,
    this.isLoading = false,
  });

  final String label;

  /// The provider's letterform, set in the display face. Lucide carries no
  /// brand glyphs, and a generic icon in their place reads as a bug.
  final String mark;
  final VoidCallback? onTap;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Pressable(
      onTap: onTap,
      child: Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: palette.card,
          border: Border.all(color: palette.hairline),
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isLoading)
              const SizedBox(
                width: 15,
                height: 15,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Text(
                mark,
                style: AppTypography.display(size: 17, color: palette.ink),
              ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              label.toUpperCase(),
              style: AppTypography.label(size: 10, color: palette.ink),
            ),
          ],
        ),
      ),
    );
  }
}

/// Inline auth error. Bordered rather than filled, so a failed attempt informs
/// without turning the whole form red.
class _ErrorNote extends StatelessWidget {
  const _ErrorNote(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.06),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.28)),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(LucideIcons.circleAlert, size: 16, color: AppColors.danger),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.danger, fontSize: 13, height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}
