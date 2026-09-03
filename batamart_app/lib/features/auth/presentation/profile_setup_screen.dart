import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/picklist.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../state/auth_controller.dart';

/// Required before checkout (BUILD_PLAN Phase 3) — the router forces any
/// buyer/seller lacking hostel/room/landmark here (see `app_router.dart`'s
/// `hasDeliveryProfile` check). Calls `PATCH /api/auth/update-profile`
/// (BACKEND_REFERENCE.md §3.1 — preferred over the narrower `PUT
/// /api/auth/profile`).
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _roomNumberController = TextEditingController();
  String? _hostelName;
  String? _landmark;
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _roomNumberController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_hostelName == null ||
        _hostelName!.isEmpty ||
        _landmark == null ||
        _landmark!.isEmpty) {
      setState(() => _error = 'Hostel and landmark are both required.');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .updateDeliveryProfile(
            hostelName: _hostelName!,
            roomNumber: _roomNumberController.text.trim(),
            landmark: _landmark!,
          );
      // Router redirect takes over once hasDeliveryProfile flips true.
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not save: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final hostels = extractPicklist(user?.university?.hostels);
    final landmarks = extractPicklist(user?.university?.deliveryAreas);

    return Scaffold(
      appBar: const BataAppBar(title: 'Delivery Details'),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Where should orders be delivered? This is required before you can check out.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.xl),
              hostels.isNotEmpty
                  ? DropdownButtonFormField<String>(
                      initialValue: _hostelName,
                      decoration: const InputDecoration(labelText: 'Hostel'),
                      items: hostels
                          .map(
                            (h) => DropdownMenuItem(value: h, child: Text(h)),
                          )
                          .toList(),
                      onChanged: (v) => setState(() => _hostelName = v),
                    )
                  : AppTextField(
                      label: 'Hostel',
                      onChanged: (v) => _hostelName = v,
                    ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                controller: _roomNumberController,
                label: 'Room Number',
              ),
              const SizedBox(height: AppSpacing.md),
              landmarks.isNotEmpty
                  ? DropdownButtonFormField<String>(
                      initialValue: _landmark,
                      decoration: const InputDecoration(
                        labelText: 'Delivery Zone / Landmark',
                      ),
                      items: landmarks
                          .map(
                            (l) => DropdownMenuItem(value: l, child: Text(l)),
                          )
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
                label: 'Save & Continue',
                onPressed: _submit,
                isLoading: _isSubmitting,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
