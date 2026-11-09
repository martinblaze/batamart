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
import '../../../core/utils/money.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/ticket_models.dart';
import '../state/tickets_providers.dart';
import 'ticket_widgets.dart';

/// Public events list: flyer cards, price from, sold out, search.
class EventsScreen extends ConsumerStatefulWidget {
  const EventsScreen({super.key});

  @override
  ConsumerState<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends ConsumerState<EventsScreen> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(eventsProvider);
    final p = context.palette;

    return Scaffold(
      appBar: BataAppBar(
        title: 'Events',
        showBack: true,
        actions: [
          IconButton(
            tooltip: 'My tickets',
            icon: const Icon(LucideIcons.ticket, size: 20),
            onPressed: () => context.push(AppRoutes.myTickets),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.sm,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (v) =>
                  ref.read(eventsSearchProvider.notifier).state = v.trim(),
              decoration: InputDecoration(
                hintText: 'Search events',
                prefixIcon: Icon(LucideIcons.search, size: 18, color: p.inkMuted),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(LucideIcons.x, size: 16),
                        onPressed: () {
                          _search.clear();
                          ref.read(eventsSearchProvider.notifier).state = '';
                          setState(() {});
                        },
                      ),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Expanded(
            child: eventsAsync.when(
              data: (events) {
                if (events.isEmpty) {
                  return const EmptyState(
                    icon: LucideIcons.ticket,
                    title: 'No events yet',
                    message: 'Upcoming events you can buy tickets for show up here.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref.refresh(eventsProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    itemCount: events.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: AppSpacing.lg),
                    itemBuilder: (context, i) =>
                        _EventCard(event: events[i]).enter(index: i.clamp(0, 6)),
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorState(
                message: 'Could not load events.\n$e',
                onRetry: () => ref.invalidate(eventsProvider),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({required this.event});

  final EventSummary event;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Pressable(
      onTap: () => context.push(AppRoutes.eventDetailPath(event.id)),
      child: Container(
        decoration: BoxDecoration(
          color: p.card,
          border: Border.all(color: p.hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                FlyerImage(url: event.flyerUrl),
                if (event.soldOut)
                  const Positioned(
                    top: AppSpacing.sm,
                    left: AppSpacing.sm,
                    child: TicketBadge(label: 'Sold out', color: AppColors.danger),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.display(size: 18, weight: FontWeight.w700),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  InfoLine(
                    icon: LucideIcons.calendar,
                    text: formatEventWhen(event.startsAt),
                  ),
                  const SizedBox(height: 4),
                  InfoLine(icon: LucideIcons.mapPin, text: event.venue),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    event.soldOut
                        ? 'SOLD OUT'
                        : event.fromPrice == null
                        ? 'TICKETS'
                        : 'FROM ${naira(event.fromPrice!)}',
                    style: AppTypography.label(
                      size: 11,
                      color: event.soldOut ? AppColors.danger : p.ink,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
