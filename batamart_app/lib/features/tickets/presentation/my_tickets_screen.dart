import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/ticket_models.dart';
import '../state/tickets_providers.dart';
import 'ticket_widgets.dart';

enum _Tab { upcoming, used, past }

/// The signed-in user's tickets (GET /api/tickets/mine).
class MyTicketsScreen extends ConsumerStatefulWidget {
  const MyTicketsScreen({super.key, this.justPaid = false});

  /// Arrived from a successful purchase: shows a confirmation banner.
  final bool justPaid;

  @override
  ConsumerState<MyTicketsScreen> createState() => _MyTicketsScreenState();
}

class _MyTicketsScreenState extends ConsumerState<MyTicketsScreen> {
  _Tab _tab = _Tab.upcoming;

  static const _labels = {
    _Tab.upcoming: 'Upcoming',
    _Tab.used: 'Used',
    _Tab.past: 'Past',
  };

  bool _matches(MyTicket t) {
    switch (_tab) {
      case _Tab.upcoming:
        return t.isValid && !t.isPast;
      case _Tab.used:
        return t.isCheckedIn;
      case _Tab.past:
        return !t.isCheckedIn && (t.isPast || !t.isValid);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(myTicketsProvider);
    return Scaffold(
      appBar: BataAppBar(
        title: 'My tickets',
        showBack: true,
        actions: [
          IconButton(
            tooltip: 'Browse events',
            icon: const Icon(LucideIcons.calendar, size: 20),
            onPressed: () => context.push(AppRoutes.events),
          ),
        ],
      ),
      body: Column(
        children: [
          if (widget.justPaid)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                0,
              ),
              padding: const EdgeInsets.all(AppSpacing.md),
              color: AppColors.success.withValues(alpha: 0.12),
              child: const Row(
                children: [
                  Icon(LucideIcons.circleCheck, size: 18, color: AppColors.success),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Payment received. Your tickets are below.',
                      style: TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.sm,
              ),
              itemCount: _Tab.values.length,
              separatorBuilder: (context, i) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) {
                final tab = _Tab.values[i];
                return ChoiceChip(
                  label: Text(_labels[tab]!),
                  selected: _tab == tab,
                  onSelected: (_) => setState(() => _tab = tab),
                );
              },
            ),
          ),
          Expanded(
            child: async.when(
              data: (all) {
                final list = all.where(_matches).toList();
                if (list.isEmpty) {
                  return EmptyState(
                    icon: LucideIcons.ticket,
                    title: 'No tickets here',
                    message: _tab == _Tab.upcoming
                        ? 'Tickets you buy show up here.'
                        : 'Nothing in this list yet.',
                    actionLabel: _tab == _Tab.upcoming ? 'Browse events' : null,
                    onActionTap: () => context.push(AppRoutes.events),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref.refresh(myTicketsProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    itemCount: list.length,
                    separatorBuilder: (context, i) =>
                        const SizedBox(height: AppSpacing.md),
                    itemBuilder: (context, i) =>
                        _TicketRow(ticket: list[i]).enter(index: i.clamp(0, 6)),
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorState(
                message: 'Could not load your tickets.\n$e',
                onRetry: () => ref.invalidate(myTicketsProvider),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TicketRow extends StatelessWidget {
  const _TicketRow({required this.ticket});

  final MyTicket ticket;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Pressable(
      onTap: ticket.isEnded ? null : () => context.push(AppRoutes.ticketPath(ticket.id)),
      child: Container(
        decoration: BoxDecoration(
          color: p.card,
          border: Border.all(color: p.hairline),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 96,
              height: 96,
              child: FlyerImage(url: ticket.event.flyerUrl, aspect: 1),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ticket.event.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.display(size: 15, weight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${ticket.tierName}  ${formatEventWhen(ticket.event.startsAt)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: p.inkSecondary),
                    ),
                    const SizedBox(height: 6),
                    TicketBadge(
                      label: ticketStatusLabel(ticket.status),
                      color: ticketStatusColor(ticket.status),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.md),
              child: Icon(LucideIcons.chevronRight, size: 16, color: p.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}
