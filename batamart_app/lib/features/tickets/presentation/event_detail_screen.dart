import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/presentation/username_sheet.dart';
import '../../auth/state/auth_controller.dart';
import '../../wallet/state/wallet_providers.dart';
import '../data/ticket_models.dart';
import '../state/tickets_providers.dart';
import 'ticket_payment_screen.dart';
import 'ticket_widgets.dart';

const _maxQuantity = 10;

/// Event detail + buy. `resellerRef` is the `?ref=` seller id from a resale
/// link; the buyer is always the signed-in user in the app.
class EventDetailScreen extends ConsumerStatefulWidget {
  const EventDetailScreen({super.key, required this.eventId, this.resellerRef});

  final String eventId;
  final String? resellerRef;

  @override
  ConsumerState<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends ConsumerState<EventDetailScreen> {
  String? _tierId;
  int _quantity = 1;
  bool _useWallet = false;
  bool _busy = false;
  String? _error;

  ({String id, String? ref}) get _key =>
      (id: widget.eventId, ref: widget.resellerRef);

  Future<String?> _askPin() {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Wallet PIN'),
        content: TextField(
          controller: controller,
          obscureText: true,
          autofocus: true,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(hintText: '6-digit PIN'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Pay'),
          ),
        ],
      ),
    );
  }

  Future<void> _buy(EventDetail event, TicketTierInfo tier) async {
    // The buyer needs a username before buying (server error USERNAME_REQUIRED).
    if ((ref.read(authControllerProvider).user?.username ?? '').isEmpty) {
      final saved = await showUsernameSheet(context);
      if (!saved || !mounted) return;
    }

    String? pin;
    if (_useWallet &&
        (ref.read(authControllerProvider).user?.hasWithdrawalPin ?? false)) {
      pin = await _askPin();
      if (pin == null || pin.isEmpty || !mounted) return;
    }

    Haptics.commit();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await _checkout(event, tier, pin);
      if (!mounted) return;
      if (_useWallet) {
        ref.invalidate(walletProvider);
        await _openTickets();
      } else {
        final url = result.authorizationUrl;
        if (url == null || url.isEmpty) {
          setState(() => _error = 'Could not start the payment. Try again.');
          return;
        }
        final ok = await Navigator.of(context).push<bool>(
          MaterialPageRoute(builder: (_) => TicketPaymentScreen(url: url)),
        );
        if (!mounted) return;
        if (ok == true) {
          await _openTickets();
        } else if (ok == null) {
          // Backed out of the payment page: it may still have gone through.
          ref.invalidate(myTicketsProvider);
          ref.invalidate(eventDetailProvider(_key));
        } else {
          setState(
            () => _error = 'The payment did not go through. You were not charged.',
          );
        }
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Runs the checkout call, recovering once from USERNAME_REQUIRED and
  /// PIN_REQUIRED by asking and retrying.
  Future<CheckoutResult> _checkout(
    EventDetail event,
    TicketTierInfo tier,
    String? pin,
  ) async {
    final repo = ref.read(ticketsRepositoryProvider);
    Future<CheckoutResult> call(String? p) => repo.checkout(
      eventId: event.id,
      tierId: tier.id,
      quantity: _quantity,
      method: _useWallet ? 'WALLET' : 'CARD',
      resellerId: event.reseller?.id,
      pin: p,
    );
    try {
      return await call(pin);
    } on ApiException catch (e) {
      final code = e.body?['code'];
      if (code == 'USERNAME_REQUIRED') {
        final saved = await showUsernameSheet(context);
        if (!saved || !mounted) rethrow;
        return call(pin);
      }
      if (code == 'PIN_REQUIRED' && _useWallet && pin == null) {
        final entered = await _askPin();
        if (entered == null || entered.isEmpty) rethrow;
        return call(entered);
      }
      rethrow;
    }
  }

  Future<void> _openTickets() async {
    ref.invalidate(myTicketsProvider);
    ref.invalidate(eventDetailProvider(_key));
    if (!mounted) return;
    context.pushReplacement('${AppRoutes.myTickets}?paid=1');
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(eventDetailProvider(_key));
    return Scaffold(
      appBar: const BataAppBar(title: 'Event', showBack: true),
      body: async.when(
        data: _body,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: 'Could not load this event.\n$e',
          onRetry: () => ref.invalidate(eventDetailProvider(_key)),
        ),
      ),
    );
  }

  Widget _body(EventDetail event) {
    final p = context.palette;
    TicketTierInfo? selected;
    for (final t in event.tiers) {
      if (t.id == _tierId) selected = t;
    }
    final total = selected == null ? 0 : selected.price * _quantity;
    final walletBalance = ref.watch(walletProvider).asData?.value.availableBalance;
    final walletShort =
        _useWallet && walletBalance != null && walletBalance < total;

    return ListView(
      children: [
        FlyerImage(url: event.flyerUrl),
        Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                event.name,
                style: AppTypography.display(size: 24, weight: FontWeight.w700),
              ),
              if (event.hostName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Hosted by ${event.hostName}',
                  style: TextStyle(fontSize: 13, color: p.inkSecondary),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              InfoLine(
                icon: LucideIcons.calendar,
                text: formatEventWhen(event.startsAt),
              ),
              const SizedBox(height: 6),
              InfoLine(
                icon: LucideIcons.mapPin,
                text: [
                  event.venue,
                  event.address,
                ].where((s) => s.isNotEmpty).join(', '),
              ),
              if (event.reseller != null) ...[
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: p.card,
                    border: Border.all(color: p.hairline),
                  ),
                  child: Row(
                    children: [
                      Icon(LucideIcons.store, size: 16, color: p.inkMuted),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'You are buying from ${event.reseller!.name}'
                          '${event.reseller!.username == null ? '' : ' (@${event.reseller!.username})'}',
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (event.description.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  event.description,
                  style: TextStyle(height: 1.55, color: p.inkSecondary),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              Text(
                'TICKETS',
                style: AppTypography.label(size: 10, color: p.inkSecondary),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (event.tiers.isEmpty)
                Text(
                  'No tickets are on sale for this event.',
                  style: TextStyle(color: p.inkSecondary),
                ),
              for (final t in event.tiers) ...[
                _TierTile(
                  tier: t,
                  selected: t.id == _tierId,
                  onTap: t.canBuy
                      ? () => setState(() {
                          _tierId = t.id;
                          _quantity = _quantity.clamp(1, _cap(t));
                        })
                      : null,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              if (selected != null) ...[
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Text(
                      'QUANTITY',
                      style: AppTypography.label(size: 10, color: p.inkSecondary),
                    ),
                    const Spacer(),
                    _Stepper(
                      value: _quantity,
                      onMinus: _quantity > 1
                          ? () => setState(() => _quantity--)
                          : null,
                      onPlus: _quantity < _cap(selected)
                          ? () => setState(() => _quantity++)
                          : null,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('Card or transfer'),
                      selected: !_useWallet,
                      onSelected: (_) => setState(() => _useWallet = false),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    ChoiceChip(
                      label: Text(
                        walletBalance == null
                            ? 'Wallet'
                            : 'Wallet (${naira(walletBalance)})',
                      ),
                      selected: _useWallet,
                      onSelected: (_) => setState(() => _useWallet = true),
                    ),
                  ],
                ),
                if (walletShort) ...[
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                    'Your wallet is short for this purchase. Add money from the Wallet screen first.',
                    style: TextStyle(color: AppColors.danger, fontSize: 12),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'TOTAL',
                      style: AppTypography.label(size: 10, color: p.ink),
                    ),
                    Text(
                      naira(total),
                      style: AppTypography.figure(size: 26, color: p.ink),
                    ),
                  ],
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.lg),
              PrimaryButton(
                label: selected == null ? 'Choose a ticket' : 'Buy tickets',
                icon: LucideIcons.lock,
                isLoading: _busy,
                onPressed: selected == null || walletShort
                    ? null
                    : () => _buy(event, selected!),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Tickets are final: no refunds, including if the event is cancelled.',
                style: TextStyle(fontSize: 11, color: p.inkMuted, height: 1.4),
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ],
    );
  }

  int _cap(TicketTierInfo t) =>
      t.available < _maxQuantity ? t.available.clamp(1, _maxQuantity) : _maxQuantity;
}

class _TierTile extends StatelessWidget {
  const _TierTile({required this.tier, required this.selected, this.onTap});

  final TicketTierInfo tier;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final soldOut = tier.available <= 0;
    final note = !tier.saleOpen
        ? (tier.saleMessage ?? 'Not on sale')
        : soldOut
        ? 'Sold out'
        : tier.available <= 10
        ? 'Only ${tier.available} left'
        : null;
    return Opacity(
      opacity: onTap == null ? 0.6 : 1,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: p.card,
            border: Border.all(
              color: selected ? p.ink : p.hairline,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              if (tier.imageUrl.isNotEmpty) ...[
                SizedBox(
                  width: 52,
                  height: 52,
                  child: AppNetworkImage(tier.imageUrl, width: 52, height: 52),
                ),
                const SizedBox(width: AppSpacing.md),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tier.name,
                      style: AppTypography.display(
                        size: 15,
                        weight: FontWeight.w600,
                      ),
                    ),
                    if (tier.description.isNotEmpty)
                      Text(
                        tier.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: p.inkSecondary),
                      ),
                    if (note != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          note,
                          style: TextStyle(
                            fontSize: 11,
                            color: soldOut || !tier.saleOpen
                                ? AppColors.danger
                                : AppColors.warning,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                naira(tier.price),
                style: AppTypography.figure(size: 16, color: p.ink),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, this.onMinus, this.onPlus});

  final int value;
  final VoidCallback? onMinus;
  final VoidCallback? onPlus;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton.outlined(
          tooltip: 'Fewer',
          onPressed: onMinus,
          icon: const Icon(LucideIcons.minus, size: 16),
        ),
        SizedBox(
          width: 40,
          child: Text(
            '$value',
            textAlign: TextAlign.center,
            style: AppTypography.figure(size: 18),
          ),
        ),
        IconButton.outlined(
          tooltip: 'More',
          onPressed: onPlus,
          icon: const Icon(LucideIcons.plus, size: 16),
        ),
      ],
    );
  }
}
