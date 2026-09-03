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
    title: 'Edit Profile',
    child: const _EditProfileForm(),
  );
}

class _EditProfileForm extends ConsumerStatefulWidget {
  const _EditProfileForm();

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
  String? _hostelName;
  String? _landmark;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _hostelName = user?.hostelName;
    _landmark = user?.landmark;
  }

  @override
  void dispose() {
    _nameController.dispose();
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
    final hostels = extractPicklist(user?.university?.hostels);
    final landmarks = extractPicklist(user?.university?.deliveryAreas);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppTextField(controller: _nameController, label: 'Full Name'),
        const SizedBox(height: AppSpacing.md),
        hostels.isNotEmpty
            ? DropdownButtonFormField<String>(
                initialValue: _hostelName,
                decoration: const InputDecoration(labelText: 'Hostel'),
                items: hostels
                    .map((h) => DropdownMenuItem(value: h, child: Text(h)))
                    .toList(),
                onChanged: (v) => setState(() => _hostelName = v),
              )
            : AppTextField(
                label: 'Hostel',
                onChanged: (v) => _hostelName = v,
              ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(controller: _roomController, label: 'Room Number'),
        const SizedBox(height: AppSpacing.md),
        landmarks.isNotEmpty
            ? DropdownButtonFormField<String>(
                initialValue: _landmark,
                decoration: const InputDecoration(
                  labelText: 'Delivery Zone / Landmark',
                ),
                items: landmarks
                    .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                    .toList(),
                onChanged: (v) => setState(() => _landmark = v),
              )
            : AppTextField(
                label: 'Delivery Zone / Landmark',
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
