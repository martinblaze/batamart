import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../auth/state/auth_controller.dart';
import '../data/ticket_host_models.dart';
import '../state/ticket_host_providers.dart';
import 'widgets/commission_explainer.dart';
import 'widgets/host_widgets.dart';
import 'widgets/image_upload_box.dart';

class _TierDraft {
  final name = TextEditingController();
  final description = TextEditingController();
  final price = TextEditingController();
  final capacity = TextEditingController();
  final randomPct = TextEditingController(text: '0');
  final uniquePct = TextEditingController(text: '0');
  String? imageUrl;
  DateTime? saleStartsAt;
  DateTime? saleEndsAt;

  void dispose() {
    for (final c in [name, description, price, capacity, randomPct, uniquePct]) {
      c.dispose();
    }
  }
}

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// `/my-shop/events/new` - create an event. It starts as pending review.
class CreateEventScreen extends ConsumerStatefulWidget {
  const CreateEventScreen({super.key});

  @override
  ConsumerState<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends ConsumerState<CreateEventScreen> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  final _venue = TextEditingController();
  final _address = TextEditingController();
  final _checkerInput = TextEditingController();
  final _sellerInput = TextEditingController();
  final List<_TierDraft> _tiers = [_TierDraft()];
  final List<String> _checkers = [];
  final List<String> _sellers = [];

  DateTime? _startsAt;
  DateTime? _endsAt;
  String? _flyerUrl;
  bool _allowResale = true;
  bool _saving = false;
  String? _error;
  String? _checkerError;
  String? _sellerError;

  @override
  void dispose() {
    for (final c in [_name, _description, _venue, _address, _checkerInput, _sellerInput]) {
      c.dispose();
    }
    for (final t in _tiers) {
      t.dispose();
    }
    super.dispose();
  }

  void _addChecker() {
    final v = _checkerInput.text.trim().toLowerCase();
    if (v.isEmpty) return;
    if (!_emailRe.hasMatch(v)) {
      setState(() => _checkerError = 'That does not look like a valid email.');
      return;
    }
    if (_checkers.contains(v)) {
      setState(() => _checkerError = 'Already added.');
      return;
    }
    if (_checkers.length >= kMaxCheckersPerEvent) {
      setState(() => _checkerError = 'At most $kMaxCheckersPerEvent checkers.');
      return;
    }
    setState(() {
      _checkers.add(v);
      _checkerInput.clear();
      _checkerError = null;
    });
  }

  void _addSeller() {
    final v = _sellerInput.text.trim().toLowerCase().replaceFirst(RegExp(r'^@'), '');
    if (v.isEmpty) return;
    if (_sellers.contains(v)) {
      setState(() => _sellerError = 'Already added.');
      return;
    }
    if (_sellers.length >= kMaxUniqueSellersPerEvent) {
      setState(() => _sellerError = 'At most $kMaxUniqueSellersPerEvent sellers.');
      return;
    }
    setState(() {
      _sellers.add(v);
      _sellerInput.clear();
      _sellerError = null;
    });
  }

  /// Returns the tiers, or null (with [_error] set) if something is invalid.
  List<NewTierPayload>? _buildTiers() {
    final out = <NewTierPayload>[];
    for (var i = 0; i < _tiers.length; i++) {
      final t = _tiers[i];
      final label = 'Tier ${i + 1}';
      final name = t.name.text.trim();
      final price = int.tryParse(t.price.text.trim());
      final cap = int.tryParse(t.capacity.text.trim());
      final rp = int.tryParse(t.randomPct.text.trim()) ?? 0;
      final up = int.tryParse(t.uniquePct.text.trim()) ?? 0;
      String? bad;
      if (name.isEmpty) {
        bad = '$label needs a name.';
      } else if (price == null || price < kMinTicketPrice || price > kMaxTicketPrice) {
        bad = '$label price must be a whole naira amount from $kMinTicketPrice to $kMaxTicketPrice.';
      } else if (cap == null || cap < 1) {
        bad = '$label needs a capacity of at least 1.';
      } else if (rp < 0 || rp > kMaxCommissionPct || up < 0 || up > kMaxCommissionPct) {
        bad = '$label commission must be between 0 and $kMaxCommissionPct percent.';
      } else if (t.saleStartsAt != null &&
          t.saleEndsAt != null &&
          !t.saleEndsAt!.isAfter(t.saleStartsAt!)) {
        bad = '$label sale end must be after the sale start.';
      }
      if (bad != null) {
        setState(() => _error = bad);
        return null;
      }
      out.add(
        NewTierPayload(
          name: name,
          description: t.description.text.trim().isEmpty ? null : t.description.text.trim(),
          imageUrl: t.imageUrl,
          price: price!,
          capacity: cap!,
          randomCommissionPct: rp,
          uniqueCommissionPct: up,
          saleStartsAt: t.saleStartsAt,
          saleEndsAt: t.saleEndsAt,
        ),
      );
    }
    return out;
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (_name.text.trim().length < 3) {
      setState(() => _error = 'Give the event a name of at least 3 characters.');
      return;
    }
    if (_venue.text.trim().isEmpty) {
      setState(() => _error = 'Enter the venue.');
      return;
    }
    if (_startsAt == null) {
      setState(() => _error = 'Choose when the event starts.');
      return;
    }
    if (_startsAt!.isBefore(DateTime.now())) {
      setState(() => _error = 'The start time must be in the future.');
      return;
    }
    if (_endsAt != null && !_endsAt!.isAfter(_startsAt!)) {
      setState(() => _error = 'The end time must be after the start.');
      return;
    }
    if (_flyerUrl == null || _flyerUrl!.isEmpty) {
      setState(() => _error = 'Upload a flyer image.');
      return;
    }
    final tiers = _buildTiers();
    if (tiers == null) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final id = await ref.read(ticketHostRepositoryProvider).createEvent(
            name: _name.text.trim(),
            description: _description.text.trim(),
            venue: _venue.text.trim(),
            address: _address.text.trim(),
            startsAt: _startsAt!,
            endsAt: _endsAt,
            flyerUrl: _flyerUrl!,
            allowResale: _allowResale,
            tiers: tiers,
            checkerEmails: _checkers,
            sellerUsernames: _sellers,
          );
      ref.invalidate(hostEventsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Event submitted. It goes public once BataMart approves it.'),
        ),
      );
      context.pushReplacement(AppRoutes.myShopEventPath(id));
    } on ApiException catch (e) {
      // Server messages name the exact bad email/username, show them as is.
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final p = context.palette;

    if (!(user?.isSeller ?? false)) {
      return Scaffold(
        appBar: const BataAppBar(title: 'Create event', showBack: true),
        body: EmptyState(
          icon: LucideIcons.ticket,
          title: 'Only sellers can host events',
          actionLabel: 'Become a seller',
          onActionTap: () => context.push(AppRoutes.becomeSeller),
        ),
      );
    }
    if ((user?.username ?? '').isEmpty) {
      return const Scaffold(
        appBar: BataAppBar(title: 'Create event', showBack: true),
        body: EmptyState(
          icon: LucideIcons.atSign,
          title: 'Set a username first',
          message:
              'Hosts need a username so buyers and sellers can find you. Add one in your profile, then come back.',
        ),
      );
    }

    return Scaffold(
      appBar: const BataAppBar(title: 'Create event', showBack: true),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                Text(
                  'Every event is reviewed by BataMart before it goes public. BataMart keeps 10% of each ticket. There are no refunds.',
                  style: TextStyle(color: p.inkSecondary, fontSize: 13),
                ),
                const SizedBox(height: AppSpacing.xl),
                const SectionLabel('Flyer'),
                ImageUploadBox(
                  url: _flyerUrl,
                  hint: 'Upload flyer',
                  height: 200,
                  onChanged: (u) => setState(() => _flyerUrl = u),
                ),
                const SizedBox(height: AppSpacing.lg),
                AppTextField(controller: _name, label: 'Event name', required: true, maxLength: 120),
                const SizedBox(height: AppSpacing.md),
                AppTextField(controller: _description, label: 'Description', maxLines: 5),
                const SizedBox(height: AppSpacing.md),
                AppTextField(controller: _venue, label: 'Venue', required: true),
                const SizedBox(height: AppSpacing.md),
                AppTextField(controller: _address, label: 'Address', hint: 'Optional'),
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
                const SizedBox(height: AppSpacing.lg),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _allowResale,
                  onChanged: (v) => setState(() => _allowResale = v),
                  title: const Text('Allow resale'),
                  subtitle: const Text(
                    'Other sellers can sell your tickets in their shop at your price and earn the commission you set.',
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                const SectionLabel('Ticket tiers'),
                for (var i = 0; i < _tiers.length; i++) _tierCard(i),
                if (_tiers.length < kMaxTiersPerEvent)
                  SecondaryButton(
                    label: 'Add another tier',
                    icon: LucideIcons.plus,
                    onPressed: () => setState(() => _tiers.add(_TierDraft())),
                  ),
                const SizedBox(height: AppSpacing.xl),
                const SectionLabel('Door checkers'),
                Text(
                  'Optional. Each email gets a private link to sign in and scan tickets for this event only.',
                  style: TextStyle(color: p.inkSecondary, fontSize: 13),
                ),
                const SizedBox(height: AppSpacing.sm),
                _addRow(
                  controller: _checkerInput,
                  hint: 'checker@example.com',
                  keyboard: TextInputType.emailAddress,
                  onAdd: _addChecker,
                  error: _checkerError,
                ),
                _chips(_checkers),
                const SizedBox(height: AppSpacing.xl),
                if (_allowResale) ...[
                  const SectionLabel('Unique sellers'),
                  Text(
                    'Optional. Sellers you name by username earn your unique-seller commission instead of the random one.',
                    style: TextStyle(color: p.inkSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _addRow(
                    controller: _sellerInput,
                    hint: 'username',
                    onAdd: _addSeller,
                    error: _sellerError,
                  ),
                  _chips(_sellers),
                  const SizedBox(height: AppSpacing.xl),
                ],
                if (_error != null) ...[
                  InlineError(_error!),
                  const SizedBox(height: AppSpacing.md),
                ],
                PrimaryButton(
                  label: 'Submit for review',
                  isLoading: _saving,
                  onPressed: _saving ? null : _submit,
                ),
                const SizedBox(height: AppSpacing.xl),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _chips(List<String> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: [
          for (final v in items)
            RemovableChip(label: v, onRemove: () => setState(() => items.remove(v))),
        ],
      ),
    );
  }

  Widget _addRow({
    required TextEditingController controller,
    required String hint,
    required VoidCallback onAdd,
    TextInputType? keyboard,
    String? error,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: AppTextField(
                controller: controller,
                hint: hint,
                keyboardType: keyboard,
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => onAdd(),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            IconButton.filled(
              tooltip: 'Add',
              onPressed: onAdd,
              icon: const Icon(LucideIcons.plus),
            ),
          ],
        ),
        if (error != null) ...[
          const SizedBox(height: AppSpacing.xs),
          InlineError(error),
        ],
      ],
    );
  }

  Widget _tierCard(int i) {
    final t = _tiers[i];
    final p = context.palette;
    return PanelCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Tier ${i + 1}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (_tiers.length > 1)
                IconButton(
                  tooltip: 'Remove tier',
                  icon: const Icon(LucideIcons.trash2, size: 18),
                  onPressed: () => setState(() {
                    _tiers.removeAt(i).dispose();
                  }),
                ),
            ],
          ),
          AppTextField(controller: t.name, label: 'Name', hint: 'Regular, VIP...', required: true),
          const SizedBox(height: AppSpacing.md),
          AppTextField(controller: t.description, label: 'Description', hint: 'Optional'),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AppTextField(
                  controller: t.price,
                  label: 'Price (NGN)',
                  required: true,
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: AppTextField(
                  controller: t.capacity,
                  label: 'Capacity',
                  required: true,
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
                  controller: t.randomPct,
                  label: 'Random sellers %',
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: AppTextField(
                  controller: t.uniquePct,
                  label: 'Unique sellers %',
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          DateTimeField(
            label: 'Sales open',
            value: t.saleStartsAt,
            helper: 'Optional. Leave empty to sell as soon as the event is live.',
            onChanged: (d) => setState(() => t.saleStartsAt = d),
          ),
          const SizedBox(height: AppSpacing.md),
          DateTimeField(
            label: 'Sales close',
            value: t.saleEndsAt,
            firstDate: t.saleStartsAt,
            onChanged: (d) => setState(() => t.saleEndsAt = d),
          ),
          const SizedBox(height: AppSpacing.md),
          Text('TIER IMAGE (OPTIONAL)', style: TextStyle(fontSize: 10, color: p.inkSecondary)),
          const SizedBox(height: AppSpacing.sm),
          ImageUploadBox(
            url: t.imageUrl,
            height: 100,
            width: 160,
            hint: 'Add image',
            onChanged: (u) => setState(() => t.imageUrl = u),
          ),
        ],
      ),
    );
  }
}
