import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../data/reports_repository.dart';
import '../state/disputes_providers.dart';

/// WEB_PAGES_REFERENCE.md's generic "Report" page ("report a product /
/// report a rider", prefilled via query param). Product reports actually
/// go through the product-specific `POST /api/products/{id}/report`
/// (wired directly into Product Detail's own report sheet in Phase 4) —
/// this screen backs `POST /api/reports` (BACKEND_REFERENCE.md §3.9),
/// used for reporting a rider or seller from an order.
class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({
    super.key,
    required this.type,
    this.reportedUserId,
    this.reportedOrderId,
    this.subjectLabel,
  });

  /// "PRODUCT" | "SELLER" | "RIDER" | "BUYER" (§3.9).
  final String type;
  final String? reportedUserId;
  final String? reportedOrderId;
  final String? subjectLabel;

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  String _reason = kReportReasons.first;
  final _descriptionController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_descriptionController.text.trim().length < 10) {
      setState(
        () => _error = 'Please describe the issue (at least 10 characters).',
      );
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref
          .read(reportsRepositoryProvider)
          .submitReport(
            type: widget.type,
            reason: _reason,
            description: _descriptionController.text.trim(),
            reportedUserId: widget.reportedUserId,
            reportedOrderId: widget.reportedOrderId,
          );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Report submitted.')));
        context.go(AppRoutes.home);
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
      appBar: BataAppBar(
        title: 'Report ${widget.type.toLowerCase()}',
        showBack: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.subjectLabel != null) ...[
              Text(
                widget.subjectLabel!,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            const Text('Reason', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: _reason,
              items: kReportReasons
                  .map(
                    (r) => DropdownMenuItem(
                      value: r,
                      child: Text(r.replaceAll('_', ' ')),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _reason = v ?? _reason),
            ),
            const SizedBox(height: AppSpacing.lg),
            const Text(
              'Description',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(controller: _descriptionController, maxLines: 4),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: const TextStyle(color: AppColors.danger)),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(
              label: 'Submit Report',
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
