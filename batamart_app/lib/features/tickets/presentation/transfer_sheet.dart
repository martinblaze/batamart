import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../state/tickets_providers.dart';

/// "Send to a friend". Resolves to true once the ticket has been moved.
Future<bool> showTransferSheet(BuildContext context, String ticketId) async {
  final done = await AppBottomSheet.show<bool>(
    context: context,
    title: 'Send to a friend',
    child: _TransferForm(ticketId: ticketId),
  );
  return done ?? false;
}

class _TransferForm extends ConsumerStatefulWidget {
  const _TransferForm({required this.ticketId});

  final String ticketId;

  @override
  ConsumerState<_TransferForm> createState() => _TransferFormState();
}

class _TransferFormState extends ConsumerState<_TransferForm> {
  final _controller = TextEditingController();
  bool _busy = false;
  String? _error;

  /// Set once the username was looked up and found.
  String? _friendName;
  String? _friendUsername;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String get _typed => _controller.text.trim().toLowerCase().replaceAll('@', '');

  Future<void> _lookup() async {
    final username = _typed;
    if (username.isEmpty) {
      setState(() => _error = 'Enter your friend\'s username.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final name = await ref.read(ticketsRepositoryProvider).lookupUser(username);
      if (!mounted) return;
      setState(() {
        if (name == null) {
          _error = 'No active user with that username (you cannot send a ticket to yourself).';
        } else {
          _friendName = name;
          _friendUsername = username;
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(ticketsRepositoryProvider)
          .transfer(widget.ticketId, _friendUsername!);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final confirming = _friendName != null;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          color: AppColors.warning.withValues(alpha: 0.12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(LucideIcons.triangleAlert, size: 16, color: AppColors.warning),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'This moves the ticket to your friend and stops it working for you. You cannot undo it.',
                  style: TextStyle(fontSize: 12, height: 1.45, color: p.ink),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AppTextField(
          controller: _controller,
          label: 'Friend\'s username',
          hint: 'e.g. chidi22',
          enabled: !confirming && !_busy,
          onChanged: (_) => setState(() => _error = null),
        ),
        if (confirming) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              const Icon(LucideIcons.userCheck, size: 18, color: AppColors.success),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Send to $_friendName (@$_friendUsername)?',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(_error!, style: const TextStyle(color: AppColors.danger)),
        ],
        const SizedBox(height: AppSpacing.lg),
        if (!confirming)
          PrimaryButton(label: 'Find friend', isLoading: _busy, onPressed: _lookup)
        else ...[
          DangerButton(
            label: 'Send ticket',
            icon: LucideIcons.send,
            isLoading: _busy,
            onPressed: _send,
          ),
          const SizedBox(height: AppSpacing.sm),
          GhostButton(
            label: 'Use a different username',
            onPressed: _busy
                ? null
                : () => setState(() {
                    _friendName = null;
                    _friendUsername = null;
                  }),
          ),
        ],
      ],
    );
  }
}
