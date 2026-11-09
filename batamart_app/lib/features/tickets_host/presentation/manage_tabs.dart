import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../data/ticket_host_models.dart';
import '../state/ticket_host_providers.dart';
import 'widgets/commission_explainer.dart';
import 'widgets/host_actions.dart';
import 'widgets/host_widgets.dart';

// ---------------------------------------------------------------- Tiers

class TiersTab extends ConsumerWidget {
  const TiersTab({super.key, required this.event, required this.onChanged});
  final HostEventDetail event;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    if (event.tiers.isEmpty) {
      return const EmptyState(title: 'No tiers', icon: LucideIcons.ticket);
    }
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Text(
          'Price, commission, capacity and sale window can change any time and apply to future sales. Capacity can never go below tickets already sold.',
          style: TextStyle(color: p.inkSecondary, fontSize: 13),
        ),
        const SizedBox(height: AppSpacing.md),
        for (final t in event.tiers)
          PanelCard(
            onTap: event.isCancelled
                ? null
                : () async {
                    final saved = await AppBottomSheet.show<bool>(
                      context: context,
                      title: 'Edit ${t.name}',
                      child: _TierEditForm(eventId: event.id, tier: t),
                    );
                    if (saved == true) onChanged();
                  },
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (t.imageUrl != null) ...[
                  AppNetworkImage(t.imageUrl!, width: 56, height: 56),
                  const SizedBox(width: AppSpacing.md),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.name,
                        style: AppTypography.display(size: 15, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${naira(t.price)}  -  ${t.sold} of ${t.capacity} sold${t.isActive ? '' : '  -  off sale'}',
                        style: TextStyle(color: p.inkSecondary, fontSize: 13),
                      ),
                      Text(
                        'Commission: random ${t.randomCommissionPct}%, unique ${t.uniqueCommissionPct}%',
                        style: TextStyle(color: p.inkSecondary, fontSize: 13),
                      ),
                      if (t.saleStartsAt != null || t.saleEndsAt != null)
                        Text(
                          'Sales: ${t.saleStartsAt == null ? 'now' : formatShort(t.saleStartsAt)} to ${t.saleEndsAt == null ? 'event' : formatShort(t.saleEndsAt)}',
                          style: TextStyle(color: p.inkMuted, fontSize: 12),
                        ),
                    ],
                  ),
                ),
                if (!event.isCancelled)
                  Icon(LucideIcons.pencil, size: 16, color: p.inkMuted),
              ],
            ),
          ),
        if (!event.isCancelled && event.tiers.length < kMaxTiersPerEvent)
          SecondaryButton(
            label: 'Add ticket type',
            onPressed: () async {
              final saved = await AppBottomSheet.show<bool>(
                context: context,
                title: 'New ticket type',
                child: _NewTierForm(eventId: event.id),
              );
              if (saved == true) onChanged();
            },
          ),
      ],
    );
  }
}

class _NewTierForm extends ConsumerStatefulWidget {
  const _NewTierForm({required this.eventId});
  final String eventId;

  @override
  ConsumerState<_NewTierForm> createState() => _NewTierFormState();
}

class _NewTierFormState extends ConsumerState<_NewTierForm> {
  final _name = TextEditingController();
  final _price = TextEditingController();
  final _capacity = TextEditingController();
  final _random = TextEditingController(text: '0');
  final _unique = TextEditingController(text: '0');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _price, _capacity, _random, _unique]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final price = int.tryParse(_price.text.trim());
    final cap = int.tryParse(_capacity.text.trim());
    final rp = int.tryParse(_random.text.trim());
    final up = int.tryParse(_unique.text.trim());
    String? bad;
    if (name.isEmpty) {
      bad = 'Give the ticket type a name.';
    } else if (price == null || price < kMinTicketPrice || price > kMaxTicketPrice) {
      bad = 'Price must be from $kMinTicketPrice to $kMaxTicketPrice naira.';
    } else if (cap == null || cap < 1) {
      bad = 'Capacity must be at least 1.';
    } else if (rp == null || up == null || rp < 0 || up < 0 || rp > kMaxCommissionPct || up > kMaxCommissionPct) {
      bad = 'Commission must be between 0 and $kMaxCommissionPct percent.';
    }
    if (bad != null) {
      setState(() => _error = bad);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(ticketHostRepositoryProvider).addTier(
            widget.eventId,
            NewTierPayload(
              name: name,
              price: price!,
              capacity: cap!,
              randomCommissionPct: rp!,
              uniqueCommissionPct: up!,
            ),
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Flexible(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppTextField(controller: _name, label: 'Name'),
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: AppTextField(
                    controller: _price,
                    label: 'Price (NGN)',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: AppTextField(
                    controller: _capacity,
                    label: 'Capacity',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: AppTextField(
                    controller: _random,
                    label: 'Random sellers %',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: AppTextField(
                    controller: _unique,
                    label: 'Unique sellers %',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.md),
              InlineError(_error!),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(label: 'Add ticket type', isLoading: _saving, onPressed: _saving ? null : _save),
          ],
        ),
      ),
    );
  }
}

class _TierEditForm extends ConsumerStatefulWidget {
  const _TierEditForm({required this.eventId, required this.tier});
  final String eventId;
  final HostTier tier;

  @override
  ConsumerState<_TierEditForm> createState() => _TierEditFormState();
}

class _TierEditFormState extends ConsumerState<_TierEditForm> {
  late final _price = TextEditingController(text: '${widget.tier.price}');
  late final _capacity = TextEditingController(text: '${widget.tier.capacity}');
  late final _random = TextEditingController(text: '${widget.tier.randomCommissionPct}');
  late final _unique = TextEditingController(text: '${widget.tier.uniqueCommissionPct}');
  late DateTime? _from = widget.tier.saleStartsAt;
  late DateTime? _to = widget.tier.saleEndsAt;
  late bool _active = widget.tier.isActive;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_price, _capacity, _random, _unique]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final price = int.tryParse(_price.text.trim());
    final cap = int.tryParse(_capacity.text.trim());
    final rp = int.tryParse(_random.text.trim());
    final up = int.tryParse(_unique.text.trim());
    String? bad;
    if (price == null || price < kMinTicketPrice || price > kMaxTicketPrice) {
      bad = 'Price must be from $kMinTicketPrice to $kMaxTicketPrice naira.';
    } else if (cap == null || cap < widget.tier.sold || cap < 1) {
      bad = 'Capacity cannot be below the ${widget.tier.sold} already sold.';
    } else if (rp == null || up == null || rp < 0 || up < 0 || rp > kMaxCommissionPct || up > kMaxCommissionPct) {
      bad = 'Commission must be between 0 and $kMaxCommissionPct percent.';
    } else if (_from != null && _to != null && !_to!.isAfter(_from!)) {
      bad = 'Sale end must be after the sale start.';
    }
    if (bad != null) {
      setState(() => _error = bad);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(ticketHostRepositoryProvider).updateTier(
            widget.eventId,
            widget.tier.id,
            price: price!,
            capacity: cap!,
            randomCommissionPct: rp!,
            uniqueCommissionPct: up!,
            saleStartsAt: _from,
            saleEndsAt: _to,
            isActive: _active,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Flexible(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: AppTextField(
                    controller: _price,
                    label: 'Price (NGN)',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: AppTextField(
                    controller: _capacity,
                    label: 'Capacity',
                    helper: '${widget.tier.sold} sold',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            const CommissionExplainer(),
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: AppTextField(
                    controller: _random,
                    label: 'Random sellers %',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: AppTextField(
                    controller: _unique,
                    label: 'Unique sellers %',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            DateTimeField(
              label: 'Sales open',
              value: _from,
              onChanged: (d) => setState(() => _from = d),
            ),
            const SizedBox(height: AppSpacing.md),
            DateTimeField(
              label: 'Sales close',
              value: _to,
              firstDate: _from,
              onChanged: (d) => setState(() => _to = d),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('On sale'),
              subtitle: const Text('Turn off to stop selling this tier without deleting it.'),
              value: _active,
              onChanged: (v) => setState(() => _active = v),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.md),
              InlineError(_error!),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(label: 'Save tier', isLoading: _saving, onPressed: _saving ? null : _save),
          ],
        ),
      ),
    );
  }
}

// --------------------------------------------------------------- People

class PeopleTab extends ConsumerWidget {
  const PeopleTab({super.key, required this.event, required this.onChanged});
  final HostEventDetail event;
  final VoidCallback onChanged;

  Future<void> _addChecker(BuildContext context, WidgetRef ref) async {
    final done = await AppBottomSheet.show<bool>(
      context: context,
      title: 'Add a checker',
      child: _AddPersonForm(
        fieldLabel: 'Email',
        hint: 'checker@example.com',
        keyboard: TextInputType.emailAddress,
        extraLabel: 'Name (optional)',
        helper: 'We email them a private link. They sign in with this email and can scan this event only.',
        submit: (value, extra) =>
            ref.read(ticketHostRepositoryProvider).addChecker(event.id, value.toLowerCase(), name: extra),
      ),
    );
    if (done == true) onChanged();
  }

  Future<void> _addSeller(BuildContext context, WidgetRef ref) async {
    final done = await AppBottomSheet.show<bool>(
      context: context,
      title: 'Add a unique seller',
      child: _AddPersonForm(
        fieldLabel: 'Username',
        hint: 'username',
        helper: 'They earn your unique-seller commission on tickets they sell.',
        submit: (value, _) => ref
            .read(ticketHostRepositoryProvider)
            .addSeller(event.id, value.toLowerCase().replaceFirst(RegExp(r'^@'), '')),
      ),
    );
    if (done == true) onChanged();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    final repo = ref.read(ticketHostRepositoryProvider);
    final unique = event.sellers.where((s) => s.isUnique).toList();
    final random = event.sellers.where((s) => !s.isUnique).toList();

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        const SectionLabel('Door checkers'),
        if (event.checkers.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Text('No checkers yet.', style: TextStyle(color: p.inkSecondary)),
          ),
        for (final c in event.checkers)
          PanelCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.name ?? c.email,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      if (c.name != null)
                        Text(c.email, style: TextStyle(color: p.inkSecondary, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text(
                        c.isActive
                            ? 'Last login: ${c.lastLoginAt == null ? 'never' : formatShort(c.lastLoginAt)}'
                            : 'Deactivated',
                        style: TextStyle(
                          color: c.isActive ? p.inkMuted : AppColors.danger,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        '${c.scanCount} scans, ${c.okCount} accepted',
                        style: TextStyle(color: p.inkMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (c.isActive && !event.isCancelled) ...[
                  IconButton(
                    tooltip: 'Resend link',
                    icon: const Icon(LucideIcons.send, size: 18),
                    onPressed: () async {
                      final ok = await runHostAction(
                        context,
                        () => repo.resendChecker(event.id, c.id),
                        success: 'New link sent. The old one no longer works.',
                      );
                      if (ok) onChanged();
                    },
                  ),
                  IconButton(
                    tooltip: 'Deactivate',
                    icon: const Icon(LucideIcons.userX, size: 18),
                    onPressed: () async {
                      final sure = await _confirm(
                        context,
                        'Deactivate ${c.email}?',
                        'They are signed out and cannot scan any more.',
                      );
                      if (!sure || !context.mounted) return;
                      final ok = await runHostAction(
                        context,
                        () => repo.deactivateChecker(event.id, c.id),
                        success: 'Checker deactivated.',
                      );
                      if (ok) onChanged();
                    },
                  ),
                ],
              ],
            ),
          ),
        if (!event.isCancelled)
          SecondaryButton(
            label: 'Add checker',
            icon: LucideIcons.userPlus,
            onPressed: () => _addChecker(context, ref),
          ),
        const SizedBox(height: AppSpacing.xl),
        const SectionLabel('Unique sellers'),
        if (unique.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Text(
              'No unique sellers. Anyone who resells earns the random-seller commission.',
              style: TextStyle(color: p.inkSecondary),
            ),
          ),
        for (final s in unique) _sellerCard(context, ref, s, removable: true),
        if (!event.isCancelled && event.allowResale)
          SecondaryButton(
            label: 'Add unique seller',
            icon: LucideIcons.userPlus,
            onPressed: () => _addSeller(context, ref),
          ),
        if (random.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xl),
          const SectionLabel('Other resellers'),
          for (final s in random) _sellerCard(context, ref, s, removable: false),
        ],
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }

  Widget _sellerCard(BuildContext context, WidgetRef ref, HostSeller s, {required bool removable}) {
    final p = context.palette;
    final repo = ref.read(ticketHostRepositoryProvider);
    return PanelCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.username == null ? s.name : '${s.name} (@${s.username})',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${s.ticketsSold} tickets  -  ${naira(s.grossSales)} sold  -  ${naira(s.commission)} commission',
                  style: TextStyle(color: p.inkSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          if (removable && s.rowId != null && !event.isCancelled)
            IconButton(
              tooltip: 'Remove',
              icon: const Icon(LucideIcons.trash2, size: 18),
              onPressed: () async {
                final sure = await _confirm(
                  context,
                  'Remove @${s.username ?? s.name}?',
                  'They will earn the random-seller commission from now on.',
                );
                if (!sure || !context.mounted) return;
                final ok = await runHostAction(
                  context,
                  () => repo.removeSeller(event.id, s.rowId!),
                  success: 'Seller removed.',
                );
                if (ok) onChanged();
              },
            ),
        ],
      ),
    );
  }
}

Future<bool> _confirm(BuildContext context, String title, String message) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Confirm')),
      ],
    ),
  );
  return r ?? false;
}

class _AddPersonForm extends StatefulWidget {
  const _AddPersonForm({
    required this.fieldLabel,
    required this.hint,
    required this.submit,
    this.helper,
    this.keyboard,
    this.extraLabel,
  });

  final String fieldLabel;
  final String hint;
  final String? helper;
  final TextInputType? keyboard;
  final String? extraLabel;
  final Future<void> Function(String value, String? extra) submit;

  @override
  State<_AddPersonForm> createState() => _AddPersonFormState();
}

class _AddPersonFormState extends State<_AddPersonForm> {
  final _value = TextEditingController();
  final _extra = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _value.dispose();
    _extra.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    final v = _value.text.trim();
    if (v.isEmpty) {
      setState(() => _error = 'Enter a ${widget.fieldLabel.toLowerCase()}.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final extra = _extra.text.trim();
      await widget.submit(v, extra.isEmpty ? null : extra);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      // The server names the exact email/username that failed.
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppTextField(
          controller: _value,
          label: widget.fieldLabel,
          hint: widget.hint,
          helper: widget.helper,
          keyboardType: widget.keyboard,
        ),
        if (widget.extraLabel != null) ...[
          const SizedBox(height: AppSpacing.md),
          AppTextField(controller: _extra, label: widget.extraLabel),
        ],
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.md),
          InlineError(_error!),
        ],
        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(label: 'Add', isLoading: _busy, onPressed: _busy ? null : _go),
      ],
    );
  }
}

// ---------------------------------------------------------------- Sales

class SalesTab extends StatelessWidget {
  const SalesTab({super.key, required this.event, required this.onRefresh});
  final HostEventDetail event;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    if (event.purchases.isEmpty) {
      return const EmptyState(
        icon: LucideIcons.receipt,
        title: 'No purchases yet',
        message: 'Every ticket purchase shows here with the buyer and the seller it came through.',
      );
    }
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          for (final pu in event.purchases)
            PanelCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          pu.buyerLabel,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${pu.quantity} x ${pu.tierName}',
                          style: TextStyle(color: p.inkSecondary, fontSize: 13),
                        ),
                        Text(
                          _via(pu),
                          style: TextStyle(color: p.inkMuted, fontSize: 12),
                        ),
                        if (pu.createdAt != null)
                          Text(
                            formatShort(pu.createdAt),
                            style: TextStyle(color: p.inkMuted, fontSize: 12),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    naira(pu.amount),
                    style: AppTypography.display(size: 15, weight: FontWeight.w700),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _via(HostPurchase pu) {
    if (pu.via == 'DIRECT' || pu.kind == 'DIRECT') return 'Direct from your event page';
    final kind = pu.kind == 'UNIQUE' ? 'unique seller' : 'random seller';
    return 'Via @${pu.via} ($kind)';
  }
}

// ------------------------------------------------------------- Activity

class ActivityTab extends ConsumerStatefulWidget {
  const ActivityTab({super.key, required this.event});
  final HostEventDetail event;

  @override
  ConsumerState<ActivityTab> createState() => _ActivityTabState();
}

class _ActivityTabState extends ConsumerState<ActivityTab>
    with AutomaticKeepAliveClientMixin {
  final List<AuditEntry> _entries = [];
  String? _cursor;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  bool _scansOnly = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    setState(() {
      if (more) {
        _loadingMore = true;
      } else {
        _loading = true;
        _error = null;
      }
    });
    try {
      final page = await ref
          .read(ticketHostRepositoryProvider)
          .fetchAudit(widget.event.id, cursor: more ? _cursor : null);
      if (!mounted) return;
      setState(() {
        if (!more) _entries.clear();
        _entries.addAll(page.entries);
        _cursor = page.nextCursor;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  IconData _icon(AuditEntry e) {
    final t = e.type.toUpperCase();
    if (t.contains('SCAN')) return LucideIcons.scanLine;
    if (t.contains('TRANSFER')) return LucideIcons.arrowLeftRight;
    if (t.contains('PURCHASE')) return LucideIcons.shoppingBag;
    return LucideIcons.history;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final p = context.palette;

    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Could not load activity.\n$_error', textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.md),
              SecondaryButton(label: 'Try again', expand: false, onPressed: _load),
            ],
          ),
        ),
      );
    }

    // The dashboard carries the 50 latest scans; the timeline is the fallback.
    final useDashScans = _scansOnly && widget.event.scans.isNotEmpty;
    final shown = _scansOnly
        ? (useDashScans ? widget.event.scans : _entries.where((e) => e.isScan).toList())
        : _entries;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            children: [
              ChoiceChip(
                label: const Text('All activity'),
                selected: !_scansOnly,
                onSelected: (_) => setState(() => _scansOnly = false),
              ),
              ChoiceChip(
                label: const Text('Scan log'),
                selected: _scansOnly,
                onSelected: (_) => setState(() => _scansOnly = true),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
              child: Text(
                _scansOnly ? 'No scans yet.' : 'Nothing has happened yet.',
                textAlign: TextAlign.center,
                style: TextStyle(color: p.inkSecondary),
              ),
            ),
          for (final e in shown)
            PanelCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(_icon(e), size: 18, color: p.inkSecondary),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.message.isEmpty ? e.type : e.message),
                        if (e.at != null)
                          Text(
                            formatShort(e.at),
                            style: TextStyle(color: p.inkMuted, fontSize: 12),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (_cursor != null && !useDashScans)
            SecondaryButton(
              label: _loadingMore ? 'Loading...' : 'Load more',
              onPressed: _loadingMore ? null : () => _load(more: true),
            ),
        ],
      ),
    );
  }
}
