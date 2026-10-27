import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/rider_hub_models.dart';
import '../state/rider_providers.dart';
import 'rider_deliveries_screen.dart';

enum _JobsTab { pickups, deliveries, returns }

String _naira(int n) {
  final s = n.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => ',',
  );
  return '₦$s';
}

String _day(DateTime? d) {
  if (d == null) return '';
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final l = d.toLocal();
  return '${days[l.weekday - 1]} ${l.day} ${months[l.month - 1]}';
}

/// The rider's work screen for the hub flow. Pickups: orders grouped by the
/// vendor's area, taken a whole area at a time. Deliveries: packed bags to
/// take from the hub, and the parcels the rider is out delivering, grouped by
/// area. The rider cannot mark picked up or delivered: the vendor and the
/// buyer do that. "Returns" keeps the older screen for dispute-return jobs.
class RiderJobsScreen extends ConsumerStatefulWidget {
  const RiderJobsScreen({super.key});

  @override
  ConsumerState<RiderJobsScreen> createState() => _RiderJobsScreenState();
}

class _RiderJobsScreenState extends ConsumerState<RiderJobsScreen> {
  _JobsTab _tab = _JobsTab.pickups;
  bool _busy = false;
  bool _isBroadcasting = false;

  @override
  void initState() {
    super.initState();
    final service = ref.read(locationBroadcastServiceProvider);
    _isBroadcasting = service.isBroadcasting;
    service.onAutoStopped = () {
      if (mounted) setState(() => _isBroadcasting = false);
    };
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _run(Future<String> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      _toast(await action());
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      ref.invalidate(pickupsProvider);
      ref.invalidate(deliveriesProvider);
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _claim(PickupGroup group) {
    final ids = group.orders
        .where(
          (o) =>
              o.canTakeNow &&
              (o.status == 'PENDING' || o.status == 'PROCESSING'),
        )
        .map((o) => o.id)
        .toList();
    return _run(() async {
      final n = await ref.read(riderRepositoryProvider).claimPickups(ids);
      return '$n pickup${n == 1 ? '' : 's'} added to your list.';
    });
  }

  Future<void> _notReady(PickupOrder order) {
    return _run(() async {
      await ref.read(riderRepositoryProvider).reportNotReady(order.id);
      return 'Moved to the next delivery day.';
    });
  }

  Future<void> _takeBag(PackedBag bag) {
    return _run(() async {
      final n = await ref.read(riderRepositoryProvider).takeBag(bag.orderIds);
      return '$n parcel${n == 1 ? '' : 's'} on your list. Safe trip!';
    });
  }

  Future<void> _toggleBroadcast(List<String> orderIds) async {
    final service = ref.read(locationBroadcastServiceProvider);
    if (_isBroadcasting) {
      service.stop();
      setState(() => _isBroadcasting = false);
      return;
    }
    final granted = await service.ensurePermission();
    if (!granted) {
      _toast('Location permission is required to broadcast your position.');
      return;
    }
    service.start(orderIds: orderIds);
    setState(() => _isBroadcasting = true);
  }

  Future<void> _call(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    await launchUrl(Uri(scheme: 'tel', path: phone));
  }

  @override
  Widget build(BuildContext context) {
    final pickups = ref.watch(pickupsProvider);
    final deliveries = ref.watch(deliveriesProvider);

    final activeIds = <String>[
      ...?pickups.valueOrNull?.mine.expand((g) => g.orders.map((o) => o.id)),
      ...?deliveries.valueOrNull?.mine.expand(
        (g) => g.orders.map((o) => o.id),
      ),
    ];

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.sm,
          ),
          child: Row(
            children: [
              ChoiceChip(
                label: Text(
                  'Pickups${_count(pickups.valueOrNull?.mine.fold<int>(0, (n, g) => n + g.orders.length))}',
                ),
                selected: _tab == _JobsTab.pickups,
                onSelected: (_) => setState(() => _tab = _JobsTab.pickups),
              ),
              const SizedBox(width: AppSpacing.sm),
              ChoiceChip(
                label: Text(
                  'Deliveries${_count(deliveries.valueOrNull?.mine.fold<int>(0, (n, g) => n + g.orders.length))}',
                ),
                selected: _tab == _JobsTab.deliveries,
                onSelected: (_) => setState(() => _tab = _JobsTab.deliveries),
              ),
              const SizedBox(width: AppSpacing.sm),
              ChoiceChip(
                label: const Text('Returns'),
                selected: _tab == _JobsTab.returns,
                onSelected: (_) => setState(() => _tab = _JobsTab.returns),
              ),
              const Spacer(),
              if (_tab != _JobsTab.returns)
                IconButton(
                  tooltip: _isBroadcasting
                      ? 'Stop sharing location'
                      : 'Share live location',
                  onPressed: activeIds.isEmpty && !_isBroadcasting
                      ? null
                      : () => _toggleBroadcast(activeIds),
                  icon: Icon(
                    Icons.location_on,
                    color: _isBroadcasting
                        ? AppColors.success
                        : context.palette.inkSecondary,
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: switch (_tab) {
            _JobsTab.pickups => _pickupsBody(pickups),
            _JobsTab.deliveries => _deliveriesBody(deliveries),
            _JobsTab.returns => const RiderDeliveriesScreen(),
          },
        ),
      ],
    );
  }

  String _count(int? n) => (n == null || n == 0) ? '' : ' ($n)';

  // ── Pickups ───────────────────────────────────────────────────────────────

  Widget _pickupsBody(AsyncValue<PickupsResult> async) {
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(
        message: 'Could not load pickups.\n$e',
        onRetry: () => ref.invalidate(pickupsProvider),
      ),
      data: (data) {
        if (data.mine.isEmpty && data.available.isEmpty) {
          return const EmptyState(
            title: 'No pickups right now',
            message: 'New orders to collect from vendors appear here.',
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(pickupsProvider.future),
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            children: [
              if (data.mine.isNotEmpty) ...[
                _sectionLabel('To collect now'),
                for (final g in data.mine) _minePickupCard(g),
              ],
              _sectionLabel('Available pickups'),
              if (data.available.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: Text(
                    'Nothing else open. Check back soon.',
                    style: TextStyle(color: context.palette.inkMuted),
                  ),
                )
              else
                for (final g in data.available) _availablePickupCard(g),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        );
      },
    );
  }

  Widget _sectionLabel(String text) => Padding(
    padding: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.sm),
    child: Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        letterSpacing: 1.4,
        fontWeight: FontWeight.w600,
        color: context.palette.inkMuted,
      ),
    ),
  );

  Widget _areaCard({
    required String title,
    required String subtitle,
    required List<Widget> children,
    bool initiallyExpanded = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      decoration: BoxDecoration(
        border: Border.all(color: context.palette.hairline),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: initiallyExpanded,
          leading: const Icon(Icons.place_outlined, size: 18),
          title: Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Text(
            subtitle,
            style: TextStyle(fontSize: 12, color: context.palette.inkMuted),
          ),
          childrenPadding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            AppSpacing.md,
          ),
          children: children,
        ),
      ),
    );
  }

  Widget _minePickupCard(PickupGroup group) {
    final vendors = group.orders.map((o) => o.vendorName).toSet().length;
    return _areaCard(
      initiallyExpanded: true,
      title: group.area,
      subtitle:
          '${group.orders.length} parcel${group.orders.length == 1 ? '' : 's'} · $vendors vendor${vendors == 1 ? '' : 's'}',
      children: [
        for (final o in group.orders) ...[
          const Divider(height: AppSpacing.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                o.vendorName,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              Text(
                _day(o.deliveryDate),
                style: TextStyle(
                  fontSize: 12,
                  color: context.palette.inkMuted,
                ),
              ),
            ],
          ),
          if (o.vendorPhone != null)
            InkWell(
              onTap: () => _call(o.vendorPhone),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  o.vendorPhone!,
                  style: const TextStyle(color: AppColors.primary),
                ),
              ),
            ),
          if (o.vendorPlace != null)
            Text(
              o.vendorPlace!,
              style: TextStyle(
                fontSize: 12,
                color: context.palette.inkSecondary,
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          for (final i in o.items) Text('• ${i.name} x${i.quantity}'),
          if (o.note != null && o.note!.isNotEmpty)
            Text(
              'Note: ${o.note}',
              style: TextStyle(
                fontSize: 12,
                color: context.palette.inkSecondary,
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              border: Border.all(color: context.palette.hairline),
            ),
            child: Text(
              'Check the parcel is wrapped and labelled @${o.username ?? ''} with code #${o.orderNumber}.',
              style: const TextStyle(fontSize: 12),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (o.status == 'PICKED_UP')
            const Text(
              'Vendor confirmed the handover. Take it to the hub.',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.success,
                fontWeight: FontWeight.w600,
              ),
            )
          else ...[
            Text(
              'Ask the vendor to tap "Mark picked up".',
              style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
            ),
            const SizedBox(height: AppSpacing.sm),
            SecondaryButton(
              label: 'Not ready, roll to next delivery day',
              onPressed: _busy ? null : () => _notReady(o),
            ),
          ],
        ],
      ],
    );
  }

  Widget _availablePickupCard(PickupGroup group) {
    final vendors = group.orders.map((o) => o.vendorName).toSet().length;
    final earn = group.orders.fold<int>(0, (n, o) => n + o.earn);
    return _areaCard(
      title: group.area,
      subtitle:
          '${group.orders.length} parcel${group.orders.length == 1 ? '' : 's'} · $vendors vendor${vendors == 1 ? '' : 's'} · ${_naira(earn)}',
      children: [
        for (final o in group.orders)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        o.vendorName,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        o.items.map((i) => '${i.name} x${i.quantity}').join(', '),
                        style: TextStyle(
                          fontSize: 12,
                          color: context.palette.inkSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  o.canTakeNow ? 'Ready to take' : _day(o.deliveryDate),
                  style: TextStyle(
                    fontSize: 12,
                    color: o.canTakeNow
                        ? AppColors.success
                        : context.palette.inkMuted,
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: AppSpacing.xs),
        PrimaryButton(
          label: group.claimable == 0
              ? 'Not open yet'
              : 'Take ${group.claimable} pickup${group.claimable == 1 ? '' : 's'}',
          onPressed: (_busy || group.claimable == 0) ? null : () => _claim(group),
          isLoading: _busy,
        ),
      ],
    );
  }

  // ── Deliveries ────────────────────────────────────────────────────────────

  Widget _deliveriesBody(AsyncValue<DeliveriesResult> async) {
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorState(
        message: 'Could not load deliveries.\n$e',
        onRetry: () => ref.invalidate(deliveriesProvider),
      ),
      data: (data) {
        if (data.mine.isEmpty && data.bags.isEmpty) {
          return const EmptyState(
            title: 'No deliveries yet',
            message: 'Packed bags show here once the sorting room has them ready.',
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(deliveriesProvider.future),
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            children: [
              if (data.mine.isNotEmpty) ...[
                _sectionLabel('Out for delivery'),
                for (final g in data.mine) _deliveryGroupCard(g),
              ],
              _sectionLabel('Packed bags at the hub'),
              if (data.bags.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                  child: Text(
                    'No packed bags yet.',
                    style: TextStyle(color: context.palette.inkMuted),
                  ),
                )
              else
                for (final b in data.bags) _bagCard(b),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        );
      },
    );
  }

  Widget _deliveryGroupCard(DeliveryGroup group) {
    return _areaCard(
      initiallyExpanded: true,
      title: group.area,
      subtitle:
          '${group.orders.length} parcel${group.orders.length == 1 ? '' : 's'}',
      children: [
        for (final o in group.orders) ...[
          const Divider(height: AppSpacing.lg),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '@${o.username ?? ''}  #${o.orderNumber}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              Text(
                _naira(o.earn),
                style: TextStyle(color: context.palette.inkMuted),
              ),
            ],
          ),
          if (o.buyerName != null)
            Text(
              o.buyerName!,
              style: TextStyle(
                fontSize: 12,
                color: context.palette.inkSecondary,
              ),
            ),
          const SizedBox(height: 4),
          Text(o.address),
          InkWell(
            onTap: () => _call(o.phone),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                o.phone,
                style: const TextStyle(color: AppColors.primary),
              ),
            ),
          ),
          Text(
            o.items.join(', '),
            style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
          ),
          if (o.note != null && o.note!.isNotEmpty)
            Text(
              'Note: ${o.note}',
              style: TextStyle(
                fontSize: 12,
                color: context.palette.inkSecondary,
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'After handing it over, ask the buyer to tap "Mark delivered".',
            style: TextStyle(fontSize: 12, color: context.palette.inkSecondary),
          ),
        ],
      ],
    );
  }

  Widget _bagCard(PackedBag bag) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: context.palette.hairline),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  bag.name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${bag.count} parcel${bag.count == 1 ? '' : 's'} · ${_naira(bag.earn)}',
                  style: TextStyle(
                    fontSize: 12,
                    color: context.palette.inkMuted,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 120,
            child: PrimaryButton(
              label: 'Take bag',
              onPressed: _busy ? null : () => _takeBag(bag),
            ),
          ),
        ],
      ),
    );
  }
}
