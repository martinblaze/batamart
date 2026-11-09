import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../data/ticket_host_models.dart';
import '../state/ticket_host_providers.dart';
import 'widgets/host_actions.dart';
import 'widgets/host_widgets.dart';

/// `/my-shop/tickets` - events I resell, with sales and commission earned.
class MyTicketListingsScreen extends ConsumerWidget {
  const MyTicketListingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myTicketListingsProvider);
    final userId = ref.watch(authControllerProvider).user?.id;

    return Scaffold(
      appBar: const BataAppBar(title: 'My ticket listings', showBack: true),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: 'Could not load your listings.\n$e',
          onRetry: () => ref.invalidate(myTicketListingsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              icon: LucideIcons.ticket,
              title: 'Not reselling anything yet',
              message:
                  'Open an event that allows resale and tap Sell these tickets to earn a commission on each sale.',
            );
          }
          final total = items.fold<int>(0, (s, e) => s + e.commissionEarned);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(myTicketListingsProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                StatTile(label: 'Commission earned', value: naira(total), emphasis: true),
                const SizedBox(height: AppSpacing.lg),
                for (final l in items) _ListingCard(listing: l, userId: userId),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ListingCard extends ConsumerWidget {
  const _ListingCard({required this.listing, required this.userId});
  final TicketListingItem listing;
  final String? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    final link = userId == null
        ? null
        : 'https://batamart.com/events/${listing.eventId}?ref=$userId';

    return PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  listing.eventName,
                  style: AppTypography.display(size: 15, weight: FontWeight.w700),
                ),
              ),
              _Pill(
                text: !listing.isActive
                    ? 'INACTIVE'
                    : listing.isUnique
                        ? 'UNIQUE SELLER'
                        : 'RANDOM SELLER',
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(formatWhen(listing.startsAt), style: TextStyle(color: p.inkSecondary, fontSize: 13)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${listing.ticketsSold} sold  -  ${naira(listing.commissionEarned)} earned',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          for (final t in listing.tiers)
            Text(
              '${t.name}: ${naira(t.price)}, you earn ${t.commissionPct}%',
              style: TextStyle(color: p.inkSecondary, fontSize: 12),
            ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              if (link != null && listing.isActive) ...[
                IconButton(
                  tooltip: 'Copy link',
                  icon: const Icon(LucideIcons.copy, size: 18),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: link));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Link copied.')),
                    );
                  },
                ),
                IconButton(
                  tooltip: 'Share link',
                  icon: const Icon(LucideIcons.share2, size: 18),
                  onPressed: () => SharePlus.instance.share(
                    ShareParams(text: 'Get your ticket to ${listing.eventName}: $link'),
                  ),
                ),
              ],
              const Spacer(),
              if (listing.isActive)
                TextButton(
                  onPressed: () async {
                    final sure = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Stop selling this event?'),
                        content: const Text(
                          'Your link stops working for new sales. Tickets already sold are not affected.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.of(ctx).pop(false),
                            child: const Text('Keep'),
                          ),
                          TextButton(
                            onPressed: () => Navigator.of(ctx).pop(true),
                            child: const Text('Stop selling'),
                          ),
                        ],
                      ),
                    );
                    if (sure != true || !context.mounted) return;
                    final ok = await runHostAction(
                      context,
                      () => ref.read(ticketHostRepositoryProvider).deactivateListing(listing.id),
                      success: 'Listing deactivated.',
                    );
                    if (ok) ref.invalidate(myTicketListingsProvider);
                  },
                  child: const Text('Deactivate'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        border: Border.all(color: p.hairline),
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Text(text, style: AppTypography.label(size: 10, color: p.inkSecondary)),
    );
  }
}
