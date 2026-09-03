import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/picklist.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../universities/presentation/universities_provider.dart';
import '../data/auth_models.dart';
import '../state/auth_controller.dart';

/// Signup chain per WEB_PAGES_REFERENCE.md: collect email -> OTP verify
/// (pushes `/verify-otp`, awaits the resulting `otpSessionToken`) ->
/// collect the rest -> `signup-with-password`. `hostelName`/`landmark`/
/// `roomNumber`/`universityId` are all required by that endpoint
/// (BACKEND_REFERENCE.md §3.1), so unlike the web's separate "profile
/// setup" step, a normal signup here already has a complete delivery
/// profile — Profile Setup (Phase 3 scope) exists as a fallback for
/// accounts that end up without one (e.g. the passwordless OTP-login path).
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key, this.googleSignup});

  /// Set when arriving here from Login's "Continue with Google" button on
  /// a brand-new account (`POST /api/auth/google` with `mode: 'signup'`
  /// returned `requiresProfile: true` — BACKEND_REFERENCE.md §3.1). Google
  /// already verified the email, so that step is skipped and the
  /// `signupToken` stands in for the usual email-OTP `otpSessionToken`.
  final GoogleSignupRequired? googleSignup;

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _roomNumberController = TextEditingController();
  final _referralController = TextEditingController();

  String? _otpSessionToken;
  String? _universityId;
  String? _hostelName;
  String? _landmark;
  bool _isSendingOtp = false;
  bool _isGoogleLoading = false;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final googleSignup = widget.googleSignup;
    if (googleSignup != null) {
      _otpSessionToken = googleSignup.signupToken;
      _emailController.text = googleSignup.email;
      _nameController.text = googleSignup.name ?? '';
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _roomNumberController.dispose();
    _referralController.dispose();
    super.dispose();
  }

  bool get _isVerified => _otpSessionToken != null;

  Future<void> _sendOtpAndVerify() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Enter your email first.');
      return;
    }
    setState(() {
      _isSendingOtp = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .sendSignupOtp(email: email);
      if (!mounted) return;
      final token = await context.push<String>(
        AppRoutes.verifyOtp,
        extra: {'email': email},
      );
      if (token != null) {
        setState(() => _otpSessionToken = token);
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not send code: $e');
    } finally {
      if (mounted) setState(() => _isSendingOtp = false);
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
          .continueWithGoogle(mode: 'signup');
      if (outcome is GoogleSignupRequired) {
        setState(() {
          _otpSessionToken = outcome.signupToken;
          _emailController.text = outcome.email;
          _nameController.text = outcome.name ?? '';
        });
      }
      // GoogleAuthSuccess means this Google account already has a full
      // account — the router's redirect guard takes over automatically.
    } on GoogleSignInException catch (e) {
      if (e.code != GoogleSignInExceptionCode.canceled) {
        setState(() => _error = 'Google sign-in failed: ${e.description}');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Google sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _isGoogleLoading = false);
    }
  }

  Future<void> _submit() async {
    if (_otpSessionToken == null) return;
    if (_universityId == null || _hostelName == null || _landmark == null) {
      setState(
        () => _error = 'University, hostel, and landmark are all required.',
      );
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .completeSignup(
            email: _emailController.text.trim(),
            name: _nameController.text.trim(),
            password: _passwordController.text,
            otpSessionToken: _otpSessionToken!,
            phone: _phoneController.text.trim(),
            universityId: _universityId!,
            hostelName: _hostelName!,
            roomNumber: _roomNumberController.text.trim(),
            landmark: _landmark!,
            referralCode: _referralController.text.trim().isEmpty
                ? null
                : _referralController.text.trim(),
          );
      // On success the router's redirect guard takes over automatically.
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      // Same failure mode as login_screen.dart: a non-ApiException error
      // here (secure-storage write, the post-signup me() refresh, etc.)
      // used to reset the spinner with zero explanation and no navigation
      // — indistinguishable from "I clicked Create Account and nothing
      // happened."
      if (mounted) setState(() => _error = 'Could not create account: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final universitiesAsync = ref.watch(universitiesProvider);

    return Scaffold(
      appBar: const BataAppBar(title: 'Create Account', showBack: true),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppTextField(
                controller: _emailController,
                label: 'Email',
                keyboardType: TextInputType.emailAddress,
                enabled: !_isVerified,
              ),
              const SizedBox(height: AppSpacing.md),
              if (!_isVerified) ...[
                PrimaryButton(
                  label: 'Verify Email',
                  onPressed: _sendOtpAndVerify,
                  isLoading: _isSendingOtp,
                ),
                const SizedBox(height: AppSpacing.lg),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                      ),
                      child: Text(
                        'or',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                OutlinedButton.icon(
                  onPressed: _isGoogleLoading ? null : _continueWithGoogle,
                  icon: _isGoogleLoading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.g_mobiledata),
                  label: const Text('Sign up with Google'),
                ),
              ],
              if (_isVerified) ...[
                Row(
                  children: const [
                    Icon(
                      Icons.check_circle,
                      color: AppColors.success,
                      size: 18,
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Email verified',
                      style: TextStyle(color: AppColors.success),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(controller: _nameController, label: 'Full Name'),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  controller: _phoneController,
                  label: 'Phone Number',
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  controller: _passwordController,
                  label: 'Password',
                  obscureText: true,
                ),
                const SizedBox(height: AppSpacing.md),
                universitiesAsync.when(
                  data: (universities) => DropdownButtonFormField<String>(
                    initialValue: _universityId,
                    decoration: const InputDecoration(labelText: 'University'),
                    items: universities
                        .map(
                          (uni) => DropdownMenuItem(
                            value: uni['id'] as String,
                            child: Text(uni['name']?.toString() ?? ''),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(() {
                      _universityId = value;
                      _hostelName = null;
                      _landmark = null;
                    }),
                  ),
                  loading: () => const LinearProgressIndicator(),
                  error: (error, stackTrace) => const Text(
                    'Could not load universities — check your connection.',
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                _HostelAndLandmarkPickers(
                  universitiesAsync: universitiesAsync,
                  universityId: _universityId,
                  hostelName: _hostelName,
                  landmark: _landmark,
                  onHostelChanged: (v) => setState(() => _hostelName = v),
                  onLandmarkChanged: (v) => setState(() => _landmark = v),
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  controller: _roomNumberController,
                  label: 'Room Number',
                ),
                const SizedBox(height: AppSpacing.md),
                AppTextField(
                  controller: _referralController,
                  label: 'Referral Code (optional)',
                ),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _error!,
                    style: const TextStyle(color: AppColors.danger),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                PrimaryButton(
                  label: 'Create Account',
                  onPressed: _submit,
                  isLoading: _isSubmitting,
                ),
              ] else if (_error != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Renders hostel/landmark as dropdowns when the selected university's
/// `hostels`/`deliveryAreas` JSON yields a usable string list, otherwise
/// falls back to free text (BACKEND_REFERENCE.md §2/§3.2 — shape isn't
/// asserted server-side).
class _HostelAndLandmarkPickers extends StatelessWidget {
  const _HostelAndLandmarkPickers({
    required this.universitiesAsync,
    required this.universityId,
    required this.hostelName,
    required this.landmark,
    required this.onHostelChanged,
    required this.onLandmarkChanged,
  });

  final AsyncValue<List<Map<String, dynamic>>> universitiesAsync;
  final String? universityId;
  final String? hostelName;
  final String? landmark;
  final ValueChanged<String?> onHostelChanged;
  final ValueChanged<String?> onLandmarkChanged;

  @override
  Widget build(BuildContext context) {
    final universities = universitiesAsync.asData?.value ?? const [];
    final selected = universities
        .where((u) => u['id'] == universityId)
        .toList();
    final hostels = selected.isEmpty
        ? const <String>[]
        : extractPicklist(selected.first['hostels']);
    final landmarks = selected.isEmpty
        ? const <String>[]
        : extractPicklist(selected.first['deliveryAreas']);

    return Column(
      children: [
        hostels.isNotEmpty
            ? DropdownButtonFormField<String>(
                initialValue: hostelName,
                decoration: const InputDecoration(labelText: 'Hostel'),
                items: hostels
                    .map((h) => DropdownMenuItem(value: h, child: Text(h)))
                    .toList(),
                onChanged: onHostelChanged,
              )
            : AppTextField(label: 'Hostel', onChanged: onHostelChanged),
        const SizedBox(height: AppSpacing.md),
        landmarks.isNotEmpty
            ? DropdownButtonFormField<String>(
                initialValue: landmark,
                decoration: const InputDecoration(
                  labelText: 'Delivery Zone / Landmark',
                ),
                items: landmarks
                    .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                    .toList(),
                onChanged: onLandmarkChanged,
              )
            : AppTextField(
                label: 'Delivery Zone / Landmark',
                onChanged: onLandmarkChanged,
              ),
      ],
    );
  }
}
