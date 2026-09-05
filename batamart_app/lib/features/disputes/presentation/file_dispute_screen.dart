import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/upload/upload_providers.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../auth/state/auth_controller.dart';
import '../../orders/state/orders_providers.dart';
import '../data/reports_repository.dart';
import '../state/disputes_providers.dart';

/// WEB_PAGES_REFERENCE.md's "File a Dispute": reason, description,
/// evidence upload, pickup-address confirmation, for one specific order.
/// `POST /api/disputes` (BACKEND_REFERENCE.md §3.9) requires ≥1 evidence
/// URL (upload via `/api/upload` first) and is buyer-only. `reason` has no
/// documented enum for disputes specifically (unlike `/api/reports`) — the
/// report-reason list is offered as non-binding quick-fill chips only.
class FileDisputeScreen extends ConsumerStatefulWidget {
  const FileDisputeScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<FileDisputeScreen> createState() => _FileDisputeScreenState();
}

class _FileDisputeScreenState extends ConsumerState<FileDisputeScreen> {
  final _reasonController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _hostelController = TextEditingController();
  final _roomController = TextEditingController();
  final _landmarkController = TextEditingController();

  final List<String> _evidence = [];
  bool _isUploading = false;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _hostelController.text = user?.hostelName ?? '';
    _roomController.text = user?.roomNumber ?? '';
    _landmarkController.text = user?.landmark ?? '';
  }

  @override
  void dispose() {
    _reasonController.dispose();
    _descriptionController.dispose();
    _hostelController.dispose();
    _roomController.dispose();
    _landmarkController.dispose();
    super.dispose();
  }

  Future<void> _pickEvidence() async {
    setState(() => _isUploading = true);
    try {
      final repository = ref.read(uploadRepositoryProvider);
      final file = await repository.pickImage();
      if (file == null) return;
      final url = await repository.uploadImage(file);
      setState(() => _evidence.add(url));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _submit() async {
    if (_reasonController.text.trim().isEmpty ||
        _descriptionController.text.trim().isEmpty) {
      setState(() => _error = 'Reason and description are required.');
      return;
    }
    if (_evidence.isEmpty) {
      setState(() => _error = 'At least one evidence photo is required.');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final dispute = await ref
          .read(disputesRepositoryProvider)
          .openDispute(
            orderId: widget.orderId,
            reason: _reasonController.text.trim(),
            description: _descriptionController.text.trim(),
            evidence: _evidence,
            pickupAddress: {
              'hostelName': _hostelController.text.trim(),
              'roomNumber': _roomController.text.trim(),
              'landmark': _landmarkController.text.trim(),
            },
          );
      ref.invalidate(myOrdersProvider);
      if (mounted) {
        context.pushReplacement(AppRoutes.disputeDetailPath(dispute.id));
      }
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BataAppBar(title: 'File a Dispute', showBack: true),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            const Text('Reason', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(controller: _reasonController, label: 'Short reason'),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: kReportReasons
                  .map(
                    (r) => ActionChip(
                      label: Text(r.replaceAll('_', ' ')),
                      onPressed: () =>
                          _reasonController.text = r.replaceAll('_', ' '),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: AppSpacing.lg),
            const Text(
              'Description',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(controller: _descriptionController, maxLines: 4),
            const SizedBox(height: AppSpacing.lg),
            const Text(
              'Evidence (required)',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final url in _evidence)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                    child: AppNetworkImage(url, width: 72, height: 72),
                  ),
                InkWell(
                  onTap: _isUploading ? null : _pickEvidence,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      border: Border.all(color: context.palette.hairline),
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: _isUploading
                        ? const Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(Icons.add, color: context.palette.inkSecondary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            const Text(
              'Pickup Address',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(controller: _hostelController, label: 'Hostel'),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(controller: _roomController, label: 'Room Number'),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(controller: _landmarkController, label: 'Landmark'),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(
              label: 'Submit Dispute',
              onPressed: _submit,
              isLoading: _isSubmitting,
            ),
            const SizedBox(height: AppSpacing.sm),
            Center(
              child: TextButton(
                onPressed: () => context.pop(),
                child: const Text('Cancel'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
