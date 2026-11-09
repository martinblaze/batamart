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
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../auth/state/auth_controller.dart';
import '../data/ticket_host_models.dart';
import '../state/ticket_host_providers.dart';
import 'widgets/host_widgets.dart';

/// `/my-shop/events` - every event I host, with its review status.
class HostEventsScreen extends ConsumerWidget {
  const HostEventsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final eventsAsync = ref.watch(hostEventsProvider);

    if (!(user?.isSeller ?? false)) {
      return Scaffold(
        appBar: const BataAppBar(title: 'Events', showBack: true),
        body: EmptyState(
          icon: LucideIcons.ticket,
          title: 'Sellers host events',
          message: 'Become a seller to list an event and sell tickets.',
          actionLabel: 'Become a seller',
          onActionTap: () => context.push(AppRoutes.becomeSeller),
        ),
      );
    }

    return Scaffold(
      appBar: BataAppBar(
        title: 'My events',
        showBack: true,
        actions: [
          IconButton(
            tooltip: 'Create event',
            icon: const Icon(LucideIcons.plus),
            onPressed: () => _create(context, ref),
          ),
        ],
      ),
      body: eventsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorState(
          message: 'Could not load your events.\n$e',
          onRetry: () => ref.invalidate(hostEventsProvider),
        ),
        data: (events) {
          if (events.isEmpty) {
            return EmptyState(
              icon: LucideIcons.ticket,
              title: 'No events yet',
              message:
                  'Create an event, set your ticket tiers and we review it before it goes live.',
              actionLabel: 'Create event',
              onActionTap: () => _create(context, ref),
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(hostEventsProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              children: [
                for (final e in events) _EventRow(event: e),
                const SizedBox(height: AppSpacing.lg),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    await context.push(AppRoutes.myShopEventNew);
    ref.invalidate(hostEventsProvider);
  }
}

class _EventRow extends ConsumerWidget {
  const _EventRow({required this.event});
  final HostEventSummary event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.palette;
    return PanelCard(
      onTap: () async {
        await context.push(AppRoutes.myShopEventPath(event.id));
        ref.invalidate(hostEventsProvider);
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  event.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.display(size: 16, weight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              EventStatusChip(status: event.status),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            formatWhen(event.startsAt),
            style: TextStyle(color: p.inkSecondary, fontSize: 13),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${event.ticketsSold} of ${event.capacity} sold  -  ${naira(event.revenue)}',
            style: TextStyle(color: p.inkSecondary, fontSize: 13),
          ),
          if (event.status == 'REJECTED' && event.reviewNote != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Rejected: ${event.reviewNote}',
              style: const TextStyle(color: AppColors.danger, fontSize: 13),
            ),
          ],
          if (event.status == 'PENDING_REVIEW') ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Waiting for BataMart review. It goes public once approved.',
              style: TextStyle(color: p.inkMuted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}
