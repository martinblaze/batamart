import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../state/auth_controller.dart';

/// Letters and numbers only, 3 to 20 characters. Mirrors lib/username.ts on
/// the server, which has the final say (reserved words, uniqueness).
final _usernamePattern = RegExp(r'^[a-z0-9]{3,20}$');

/// Asks the user to pick a username. Sellers write it on the parcel instead of
/// the buyer's real name or address, and checkout won't go through without
/// one. Resolves to true once it is saved.
Future<bool> showUsernameSheet(BuildContext context) async {
  final saved = await AppBottomSheet.show<bool>(
    context: context,
    title: 'Choose a username',
    child: const _UsernameForm(),
  );
  return saved ?? false;
}

class _UsernameForm extends ConsumerStatefulWidget {
  const _UsernameForm();

  @override
  ConsumerState<_UsernameForm> createState() => _UsernameFormState();
}

class _UsernameFormState extends ConsumerState<_UsernameForm> {
  final _controller = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final value = _controller.text.trim().toLowerCase();
    if (!_usernamePattern.hasMatch(value)) {
      setState(
        () => _error = 'Use 3 to 20 letters and numbers, no spaces or symbols.',
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
          .updateProfile(username: value);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Vendors write this on your parcel so your real name and address stay private.',
          style: TextStyle(color: context.palette.inkSecondary, fontSize: 13),
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          controller: _controller,
          label: 'Username',
          hint: 'e.g. chidi22',
          autofillHints: const [AutofillHints.username],
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(
          label: 'Save username',
          onPressed: _submit,
          isLoading: _isSubmitting,
        ),
      ],
    );
  }
}
