import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/ticket_host_models.dart';
import '../state/ticket_host_providers.dart';
import 'manage_tabs.dart';
import 'widgets/host_actions.dart';
import 'widgets/host_widgets.dart';

/// `/my-shop/events/:id` - the host's dashboard for one event.
class ManageEventScreen extends ConsumerWidget {
  const ManageEventScreen({super.key, required this.eventId});
  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(hostEventDetailProvider(eventId));

    return async.when(
      loading: () => const Scaffold(
        appBar: BataAppBar(title: 'Event', showBack: true),
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        appBar: const BataAppBar(title: 'Event', showBack: true),
        body: ErrorState(
          message: 'Could not load this event.\n$e',
          onRetry: () => ref.invalidate(hostEventDetailProvider(eventId)),
        ),
      ),
      data: (event) => _Body(event: event),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.event});
  final HostEventDetail event;

  void _refresh(WidgetRef ref) {
    ref.invalidate(hostEventDetailProvider(event.id));
    ref.invalidate(hostEventsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 5,
      child: Scaffold(
        appBar: AppBar(
          title: Text(event.name, overflow: TextOverflow.ellipsis),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'Overview'),
              Tab(text: 'Tiers'),
              Tab(text: 'People'),
              Tab(text: 'Sales'),
              Tab(text: 'Activity'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _OverviewTab(event: event, onChanged: () => _refresh(ref)),
            TiersTab(event: event, onChanged: () => _refresh(ref)),
            PeopleTab(event: event, onChanged: () => _refresh(ref)),
            SalesTab(event: event, onRefresh: () => _refresh(ref)),
            ActivityTab(event: event),
          ],
        ),
      ),
    );
  }
}

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab({required this.event, required this.onChanged});
  final HostEventDetail event;
  final VoidCallback onChanged;

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => _CancelDialog(eventName: event.name),
    );
    if (confirmed != true || !context.mounted) return;
    final ok = await runHostAction(
      context,
      () => ref.read(ticketHostRepositoryProvider).cancelEvent(event.id),
      success: 'Event cancelled. Ticket holders have been told.',
    );
    if (ok) onChanged();
  }

  Future<void> _edit(BuildContext context, WidgetRef ref) async {
    final changed = await AppBottomSheet.show<bool>(
      context: context,
      title: 'Edit event',
      child: _EditDetailsForm(event: event),
    );
    if (changed == true) onChanged();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    final t = event.totals;
    final hasSales = t.ticketsSold > 0;

    return RefreshIndicator(
      onRefresh: () async => onChanged(),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          if (event.flyerUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.md),
              child: AppNetworkImage(event.flyerUrl!, height: 180, width: double.infinity),
            ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              EventStatusChip(status: event.status),
              const Spacer(),
              if (!event.isCancelled)
                TextButton.icon(
                  onPressed: () => _edit(context, ref),
                  icon: const Icon(LucideIcons.pencil, size: 16),
                  label: const Text('Edit details'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            event.name,
            style: AppTypography.display(size: 20, weight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(formatWhen(event.startsAt), style: TextStyle(color: p.inkSecondary)),
          Text(
            event.address.isEmpty ? event.venue : '${event.venue}, ${event.address}',
            style: TextStyle(color: p.inkSecondary),
          ),
          if (event.status == 'REJECTED') ...[
            const SizedBox(height: AppSpacing.md),
            PanelCard(
              child: Text(
                'Rejected${event.reviewNote == null ? '' : ': ${event.reviewNote}'}. Edit the event to send it for review again.',
                style: const TextStyle(color: AppColors.danger),
              ),
            ),
          ],
          if (event.status == 'PENDING_REVIEW') ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Waiting for BataMart review. Buyers cannot see this event yet.',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          ],
          if (event.hasPendingChange) ...[
            const SizedBox(height: AppSpacing.md),
            PanelCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Awaiting approval: new ${[
                      if (event.pendingFlyerUrl != null) 'flyer',
                      if (event.pendingDescription != null) 'description',
                    ].join(' and ')}',
                    style: const TextStyle(color: AppColors.warning, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Your event stays live with the current version until BataMart approves this.',
                    style: TextStyle(color: p.inkSecondary, fontSize: 13),
                  ),
                  if (event.pendingFlyerUrl != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      child: AppNetworkImage(event.pendingFlyerUrl!, height: 140, width: double.infinity),
                    ),
                  ],
                  if (event.pendingDescription != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      event.pendingDescription!.isEmpty ? '(description removed)' : event.pendingDescription!,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  SecondaryButton(
                    label: 'Cancel this change',
                    icon: LucideIcons.x,
                    onPressed: () async {
                      final ok = await runHostAction(
                        context,
                        () => ref.read(ticketHostRepositoryProvider).cancelPendingChange(event.id),
                        success: 'The pending change was cancelled.',
                      );
                      if (ok) onChanged();
                    },
                  ),
                ],
              ),
            ),
          ],
          if (event.status == 'PAUSED') ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Sales are paused by BataMart. Contact support if you think this is a mistake.',
              style: TextStyle(color: p.inkSecondary, fontSize: 13),
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          const SectionLabel('Sales'),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: AppSpacing.sm,
            mainAxisSpacing: AppSpacing.sm,
            childAspectRatio: 2.3,
            children: [
              StatTile(label: 'Tickets sold', value: '${t.ticketsSold}'),
              StatTile(label: 'Checked in', value: '${t.checkedIn}'),
              StatTile(label: 'Gross sales', value: naira(t.grossSales)),
              StatTile(label: 'BataMart fee ($kPlatformFeePct%)', value: naira(t.platformFee)),
              StatTile(label: 'Commission paid', value: naira(t.commissionPaid)),
              StatTile(label: 'Your earnings', value: naira(t.hostEarnings), emphasis: true),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Your earnings are credited to your wallet the moment each ticket is paid. There is no escrow.',
            style: TextStyle(color: p.inkMuted, fontSize: 12),
          ),
          const SizedBox(height: AppSpacing.md),
          SecondaryButton(
            label: 'Withdraw from wallet',
            icon: LucideIcons.wallet,
            onPressed: () => context.push(AppRoutes.wallet),
          ),
          if (event.canCancel) ...[
            const SizedBox(height: AppSpacing.section),
            const SectionLabel('Danger zone'),
            Text(
              hasSales
                  ? 'Cancelling notifies all ${t.ticketsSold} ticket holders. Tickets are NOT refunded.'
                  : 'Cancelling stops all sales and cannot be undone.',
              style: TextStyle(color: p.inkSecondary, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.sm),
            DangerButton(
              label: 'Cancel event',
              icon: LucideIcons.ban,
              onPressed: () => _cancel(context, ref),
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
        ],
      ),
    );
  }
}

/// Strong confirmation: the host must type CANCEL before the button unlocks.
class _CancelDialog extends StatefulWidget {
  const _CancelDialog({required this.eventName});
  final String eventName;

  @override
  State<_CancelDialog> createState() => _CancelDialogState();
}

class _CancelDialogState extends State<_CancelDialog> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ready = _c.text.trim().toUpperCase() == 'CANCEL';
    return AlertDialog(
      title: Text('Cancel ${widget.eventName}?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'This stops all ticket sales and tells every ticket holder the event is cancelled.\n\n'
            'BataMart does NOT refund tickets. Money already paid has been credited to you, the resellers and BataMart, and it is not returned to buyers by the platform.\n\n'
            'This cannot be undone.',
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            controller: _c,
            label: 'Type CANCEL to confirm',
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Keep event'),
        ),
        DangerButton(
          label: 'Cancel event',
          expand: false,
          onPressed: ready ? () => Navigator.of(context).pop(true) : null,
        ),
      ],
    );
  }
}

/// Edit name/description/venue/address/start. Per the edit rules, an event
/// with no paid tickets goes back to review when name, venue or dates change;
/// with paid tickets the change is applied at once and holders are told.
class _EditDetailsForm extends ConsumerStatefulWidget {
  const _EditDetailsForm({required this.event});
  final HostEventDetail event;

  @override
  ConsumerState<_EditDetailsForm> createState() => _EditDetailsFormState();
}

class _EditDetailsFormState extends ConsumerState<_EditDetailsForm> {
  late final _name = TextEditingController(text: widget.event.name);
  late final _description = TextEditingController(text: widget.event.effectiveDescription);
  late final _venue = TextEditingController(text: widget.event.venue);
  late final _address = TextEditingController(text: widget.event.address);
  late DateTime? _startsAt = widget.event.startsAt;
  late DateTime? _endsAt = widget.event.endsAt;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _description, _venue, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final e = widget.event;
    final fields = <String, dynamic>{};
    if (_name.text.trim() != e.name) fields['name'] = _name.text.trim();
    if (_description.text.trim() != e.effectiveDescription) fields['description'] = _description.text.trim();
    if (_venue.text.trim() != e.venue) fields['venue'] = _venue.text.trim();
    if (_address.text.trim() != e.address) fields['address'] = _address.text.trim();
    if (_startsAt != e.startsAt && _startsAt != null) {
      fields['startsAt'] = _startsAt!.toUtc().toIso8601String();
    }
    if (_endsAt != e.endsAt) fields['endsAt'] = _endsAt?.toUtc().toIso8601String();
    if (fields.isEmpty) {
      Navigator.of(context).pop(false);
      return;
    }
    if (_name.text.trim().length < 3 || _venue.text.trim().isEmpty) {
      setState(() => _error = 'Name and venue are required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(ticketHostRepositoryProvider).updateEvent(e.id, fields);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (err) {
      if (mounted) setState(() => _error = '$err');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final paid = widget.event.totals.ticketsSold > 0;
    return Flexible(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              paid
                  ? 'Tickets are already sold. Changes to the name, venue or time apply immediately, every ticket holder is notified and BataMart is alerted.'
                  : 'Changing the name, venue or time sends the event back to review until it is approved again.',
              style: TextStyle(color: context.palette.inkSecondary, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.md),
            AppTextField(controller: _name, label: 'Event name'),
            const SizedBox(height: AppSpacing.md),
            AppTextField(controller: _description, label: 'Description', maxLines: 4),
            const SizedBox(height: AppSpacing.md),
            AppTextField(controller: _venue, label: 'Venue'),
            const SizedBox(height: AppSpacing.md),
            AppTextField(controller: _address, label: 'Address'),
            const SizedBox(height: AppSpacing.md),
            DateTimeField(
              label: 'Starts',
              required: true,
              value: _startsAt,
              onChanged: (d) => setState(() => _startsAt = d),
            ),
            const SizedBox(height: AppSpacing.md),
            DateTimeField(
              label: 'Ends',
              value: _endsAt,
              firstDate: _startsAt,
              onChanged: (d) => setState(() => _endsAt = d),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.md),
              InlineError(_error!),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(label: 'Save changes', isLoading: _saving, onPressed: _saving ? null : _save),
          ],
        ),
      ),
    );
  }
}
