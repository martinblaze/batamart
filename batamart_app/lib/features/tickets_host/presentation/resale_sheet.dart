import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../auth/state/auth_controller.dart';
import '../state/ticket_host_providers.dart';
import 'widgets/host_widgets.dart';

/// A tier as shown in the confirm step. Only name and price are needed.
class ResaleTier {
  const ResaleTier({required this.name, required this.price});
  final String name;
  final int price;
}

/// "Sell these tickets" flow for a resale-enabled event.
///
/// Open it with [ResaleSheet.show]:
///
/// ```dart
/// ResaleSheet.show(context, eventId: id, eventName: name, tiers: [
///   ResaleTier(name: 'Regular', price: 3000),
/// ]);
/// ```
///
/// Non-sellers are told why and sent to the become-seller screen. Sellers
/// confirm, the listing is created (`POST /api/tickets/listings`) and the
/// share link `https://batamart.com/events/<id>?ref=<myUserId>` is shown.
class ResaleSheet extends ConsumerStatefulWidget {
  const ResaleSheet({
    super.key,
    required this.eventId,
    required this.eventName,
    this.tiers = const [],
  });

  final String eventId;
  final String eventName;
  final List<ResaleTier> tiers;

  static Future<void> show(
    BuildContext context, {
    required String eventId,
    required String eventName,
    List<ResaleTier> tiers = const [],
  }) {
    return AppBottomSheet.show<void>(
      context: context,
      title: 'Sell these tickets',
      child: ResaleSheet(eventId: eventId, eventName: eventName, tiers: tiers),
    );
  }

  @override
  ConsumerState<ResaleSheet> createState() => _ResaleSheetState();
}

class _ResaleSheetState extends ConsumerState<ResaleSheet> {
  bool _busy = false;
  String? _error;
  String? _link;

  Future<void> _goBecomeSeller() async {
    // Capture before popping: the sheet's context is gone afterwards.
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push(AppRoutes.becomeSeller);
  }

  Future<void> _start(String userId) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(ticketHostRepositoryProvider).startReselling(widget.eventId);
      ref.invalidate(myTicketListingsProvider);
      if (mounted) {
        setState(() => _link = 'https://batamart.com/events/${widget.eventId}?ref=$userId');
      }
    } on ApiException catch (e) {
      if (e.body?['code'] == 'NOT_SELLER') {
        await _goBecomeSeller();
        return;
      }
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final user = ref.watch(authControllerProvider).user;

    if (user == null || !user.isSeller) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Only sellers can resell tickets. Become a seller, then come back to this event and tap Sell these tickets.',
            style: TextStyle(color: p.inkSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            label: 'Become a seller',
            icon: LucideIcons.store,
            onPressed: _goBecomeSeller,
          ),
        ],
      );
    }

    if (_link != null) return _success(context, _link!);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.eventName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Share your link and earn a commission on every ticket bought through it. The ticket price is set by the host and cannot be changed.',
          style: TextStyle(color: p.inkSecondary, fontSize: 13),
        ),
        if (widget.tiers.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          for (final t in widget.tiers)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Expanded(child: Text(t.name)),
                  Text(naira(t.price), style: const TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),
            ),
        ],
        const SizedBox(height: AppSpacing.md),
        Text(
          'The host decides your commission for each tier. It is paid to your wallet the moment the ticket is bought. Buyers get their own ticket, you never handle it. If you are the buyer, or the host, you earn nothing on that sale.',
          style: TextStyle(color: p.inkMuted, fontSize: 12),
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.md),
          InlineError(_error!),
        ],
        const SizedBox(height: AppSpacing.lg),
        PrimaryButton(
          label: 'Start selling',
          icon: LucideIcons.badgeCheck,
          isLoading: _busy,
          onPressed: _busy ? null : () => _start(user.id),
        ),
      ],
    );
  }

  Widget _success(BuildContext context, String link) {
    final p = context.palette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(LucideIcons.circleCheck, size: 18, color: Colors.green),
            const SizedBox(width: AppSpacing.sm),
            const Expanded(child: Text('You are selling these tickets.')),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            border: Border.all(color: p.hairline),
            color: p.page,
          ),
          child: SelectableText(link, style: const TextStyle(fontSize: 13)),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: SecondaryButton(
                label: 'Copy link',
                icon: LucideIcons.copy,
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: link));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Link copied.')),
                  );
                },
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: PrimaryButton(
                label: 'Share',
                icon: LucideIcons.share2,
                onPressed: () => SharePlus.instance.share(
                  ShareParams(text: 'Get your ticket to ${widget.eventName}: $link'),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        GhostButton(
          label: 'My ticket listings',
          icon: LucideIcons.list,
          onPressed: () {
            final router = GoRouter.of(context);
            Navigator.of(context).pop();
            router.push(AppRoutes.myShopTickets);
          },
        ),
      ],
    );
  }
}
