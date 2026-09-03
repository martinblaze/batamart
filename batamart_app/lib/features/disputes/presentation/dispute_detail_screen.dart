import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/status_chip.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/chrome/app_dialog.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../data/dispute_models.dart';
import '../state/disputes_providers.dart';

/// WEB_PAGES_REFERENCE.md's "Dispute Detail/tracking". The message thread
/// is buyer-or-admin only server-side (BACKEND_REFERENCE.md §3.9) — a
/// seller viewing their own dispute sees the record (status, reason,
/// evidence, return-stage) but never fetches/sends messages, and instead
/// gets a "Confirm Return Received" action when eligible.
class DisputeDetailScreen extends ConsumerWidget {
  const DisputeDetailScreen({super.key, required this.disputeId});

  final String disputeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final disputeAsync = ref.watch(disputeDetailProvider(disputeId));

    return Scaffold(
      appBar: const BataAppBar(title: 'Dispute', showBack: true),
      body: disputeAsync.when(
        data: (dispute) => _DisputeDetailBody(dispute: dispute),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => ErrorState(
          message: 'Could not load this dispute.\n$error',
          onRetry: () => ref.invalidate(disputeDetailProvider(disputeId)),
        ),
      ),
    );
  }
}

class _DisputeDetailBody extends ConsumerStatefulWidget {
  const _DisputeDetailBody({required this.dispute});

  final Dispute dispute;

  @override
  ConsumerState<_DisputeDetailBody> createState() => _DisputeDetailBodyState();
}

class _DisputeDetailBodyState extends ConsumerState<_DisputeDetailBody> {
  final _messageController = TextEditingController();
  bool _isSending = false;
  bool _isConfirmingReturn = false;

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  bool get _isSeller {
    final userId = ref.read(authControllerProvider).user?.id;
    return userId != null && userId == widget.dispute.sellerId;
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    setState(() => _isSending = true);
    try {
      await ref
          .read(disputesRepositoryProvider)
          .sendMessage(widget.dispute.id, text);
      _messageController.clear();
      ref.invalidate(disputeMessagesProvider(widget.dispute.id));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _confirmReturn() async {
    final confirmed = await AppDialog.confirm(
      context: context,
      title: 'Confirm Return Received?',
      message:
          'This releases a fee-adjusted refund from your escrow to the buyer.',
      confirmLabel: 'Confirm',
    );
    if (!confirmed) return;

    setState(() => _isConfirmingReturn = true);
    try {
      await ref
          .read(disputesRepositoryProvider)
          .confirmReturn(widget.dispute.id);
      ref.invalidate(disputeDetailProvider(widget.dispute.id));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _isConfirmingReturn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dispute = widget.dispute;
    final returnStage = describeReturnStage(dispute.resolution);
    final canConfirmReturn =
        _isSeller &&
        dispute.status == 'UNDER_REVIEW' &&
        dispute.resolution == '__RETURN_DELIVERED_TO_SELLER__';

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    dispute.orderNumber != null
                        ? 'Order #${dispute.orderNumber}'
                        : 'Dispute',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  StatusChip(status: dispute.status),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Reason: ${dispute.reason}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              if (dispute.description != null) ...[
                const SizedBox(height: 4),
                Text(dispute.description!),
              ],
              if (dispute.buyerEvidence.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                const Text(
                  'Evidence',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  children: [
                    for (final url in dispute.buyerEvidence)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadii.sm),
                        child: AppNetworkImage(url, width: 72, height: 72),
                      ),
                  ],
                ),
              ],
              if (returnStage != null) ...[
                const SizedBox(height: AppSpacing.lg),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Text(
                    returnStage,
                    style: const TextStyle(color: AppColors.info),
                  ),
                ),
              ],
              if (canConfirmReturn) ...[
                const SizedBox(height: AppSpacing.lg),
                PrimaryButton(
                  label: 'Confirm Return Received',
                  onPressed: _confirmReturn,
                  isLoading: _isConfirmingReturn,
                ),
              ],
              if (!_isSeller) ...[
                const SizedBox(height: AppSpacing.xl),
                const Text(
                  'Messages',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.sm),
                _MessagesList(disputeId: dispute.id),
              ],
            ],
          ),
        ),
        if (!_isSeller && !dispute.isTerminal)
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      decoration: const InputDecoration(
                        hintText: 'Message admin...',
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  IconButton(
                    tooltip: 'Send message',
                    onPressed: _isSending ? null : _sendMessage,
                    icon: _isSending
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _MessagesList extends ConsumerWidget {
  const _MessagesList({required this.disputeId});

  final String disputeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messagesAsync = ref.watch(disputeMessagesProvider(disputeId));

    return messagesAsync.when(
      data: (messages) {
        if (messages.isEmpty) {
          return const Text(
            'No messages yet.',
            style: TextStyle(color: AppColors.textSecondary),
          );
        }
        return ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: messages.length,
          itemBuilder: (context, index) =>
              _MessageBubble(message: messages[index]),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stackTrace) => Text('Could not load messages.\n$error'),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final DisputeMessage message;

  @override
  Widget build(BuildContext context) {
    final isAdmin = message.senderType == 'ADMIN';
    return Align(
      alignment: isAdmin ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(AppSpacing.sm),
        constraints: const BoxConstraints(maxWidth: 260),
        decoration: BoxDecoration(
          color: isAdmin
              ? AppColors.background
              : AppColors.primary.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isAdmin ? 'Support' : 'You',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            ),
            Text(message.message),
            if (message.createdAt != null)
              Text(
                DateFormat.jm().format(message.createdAt!),
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textSecondary,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
