import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/auth_error_message.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
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
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => context.pop())),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Welcome Back 👋',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              const Text(
                'Login to your account',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xl),
              AppTextField(
                controller: _emailController,
                label: 'Email',
                keyboardType: TextInputType.emailAddress,
                prefixIcon: Icons.mail_outline,
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                controller: _passwordController,
                label: 'Password',
                obscureText: _obscurePassword,
                prefixIcon: Icons.lock_outline,
                suffixIcon: IconButton(
                  tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off : Icons.visibility,
                  ),
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push(AppRoutes.forgotPassword),
                  child: const Text('Forget password?'),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.md),
              PrimaryButton(
                label: 'Login',
                onPressed: _submit,
                isLoading: _isLoading,
              ),
              const SizedBox(height: AppSpacing.xl),
              const Row(
                children: [
                  Expanded(child: Divider()),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                    child: Text(
                      'or continue with',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ),
                  Expanded(child: Divider()),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _SocialButton(
                    label: 'Google',
                    icon: Icons.g_mobiledata,
                    isLoading: _isGoogleLoading,
                    onTap: _isGoogleLoading ? null : _continueWithGoogle,
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  _SocialButton(
                    label: 'Facebook',
                    icon: Icons.facebook,
                    onTap: () =>
                        _showGoogleSignInStub(context, provider: 'Facebook'),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text("Don't have an account? "),
                    GestureDetector(
                      onTap: () => context.push(AppRoutes.signup),
                      child: const Text(
                        'Sign up',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
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

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onTap,
    this.isLoading = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: isLoading
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon),
      label: Text(label),
    );
  }
}
