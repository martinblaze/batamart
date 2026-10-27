import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/picklist.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../state/auth_controller.dart';

/// Name + delivery-details editing — the web app's My Profile page allows
/// this, the mobile app previously didn't (Profile Setup only ran once,
/// at signup/first-login, with no way back in). Uses
/// `AuthController.updateProfile`, a thin wrapper over
/// `PATCH /api/auth/update-profile` (BACKEND_REFERENCE.md §3.1).
void showEditProfileSheet(BuildContext context, WidgetRef ref) {
  AppBottomSheet.show(
    context: context,
    title: 'Edit profile',
    child: const _EditProfileForm(),
  );
}

/// Delivery address only.
///
/// Settings' "Delivery address" used to push /profile-setup, which is the
/// first-run onboarding screen — it redirected anyone who already had a
/// profile straight back to Home, so the row did nothing. A sheet edits the
/// address in place, which is what the row promises.
void showAddressSheet(BuildContext context, WidgetRef ref) {
  AppBottomSheet.show(
    context: context,
    title: 'Delivery address',
    child: const _EditProfileForm(addressOnly: true),
  );
}

class _EditProfileForm extends ConsumerStatefulWidget {
  const _EditProfileForm({this.addressOnly = false});

  /// Hides the name field, so the sheet is only about where things go.
  final bool addressOnly;

  @override
  ConsumerState<_EditProfileForm> createState() => _EditProfileFormState();
}

class _EditProfileFormState extends ConsumerState<_EditProfileForm> {
  late final _nameController = TextEditingController(
    text: ref.read(authControllerProvider).user?.name ?? '',
  );
  late final _roomController = TextEditingController(
    text: ref.read(authControllerProvider).user?.roomNumber ?? '',
  );
  late final _usernameController = TextEditingController();
  String? _hostelName;
  final _hostelController = TextEditingController();
  String? _landmark;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _hostelName = user?.hostelName;
    _hostelController.text = user?.hostelName ?? '';
    _landmark = user?.landmark;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _hostelController.dispose();
    _usernameController.dispose();
    _roomController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = 'Name is required.');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .updateProfile(
            name: _nameController.text.trim(),
            hostelName: _hostelName,
            roomNumber: _roomController.text.trim().isEmpty
                ? null
                : _roomController.text.trim(),
            landmark: _landmark,
            username: _usernameController.text.trim().isEmpty
                ? null
                : _usernameController.text.trim().toLowerCase(),
          );
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Profile updated.')));
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final landmarks = extractPicklist(user?.university?.deliveryAreas);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!widget.addressOnly) ...[
          AppTextField(controller: _nameController, label: 'Full name'),
          const SizedBox(height: AppSpacing.md),
          if ((user?.username ?? '').isEmpty) ...[
            AppTextField(
              controller: _usernameController,
              label: 'Username',
              hint: 'Letters and numbers only',
            ),
            const SizedBox(height: AppSpacing.md),
          ] else ...[
            Text('Username: @${user!.username}'),
            const SizedBox(height: AppSpacing.md),
          ],
        ],
        // Typed, not picked. The university's hostel list is a fixed
        // picklist that cannot know about private lodges and off-campus
        // addresses, so anyone living outside a named hall had nothing to
        // select. Free text accepts every real answer.
        AppTextField(
          controller: _hostelController,
          label: 'Hostel or lodge',
          hint: 'e.g. Python Hall, or Divine Favour Lodge',
          onChanged: (v) => _hostelName = v,
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(controller: _roomController, label: 'Room Number'),
        const SizedBox(height: AppSpacing.md),
        // Landmark stays a picklist where the university publishes one —
        // delivery pricing is zone-based server-side, so a typed value that
        // matches no zone would quietly break the fee quote.
        landmarks.isNotEmpty
            ? DropdownButtonFormField<String>(
                initialValue: _landmark,
                decoration: const InputDecoration(
                  labelText: 'Delivery zone / landmark',
                ),
                items: landmarks
                    .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                    .toList(),
                onChanged: (v) => setState(() => _landmark = v),
              )
            : AppTextField(
                label: 'Delivery zone / landmark',
                onChanged: (v) => _landmark = v,
              ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(
          label: 'Save Changes',
          onPressed: _submit,
          isLoading: _isSubmitting,
        ),
      ],
    );
  }
}
