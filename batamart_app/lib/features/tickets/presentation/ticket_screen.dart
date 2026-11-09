import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/states/error_state.dart';
import '../data/ticket_models.dart';
import '../data/ticket_qr.dart';
import '../state/tickets_providers.dart';
import 'ticket_widgets.dart';
import 'transfer_sheet.dart';

/// One ticket with its live rotating QR. The server is polled every 4 s so a
/// scan at the door flips this screen to "Checked in" within seconds.
class TicketScreen extends ConsumerStatefulWidget {
  const TicketScreen({super.key, required this.ticketId});

  final String ticketId;

  @override
  ConsumerState<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends ConsumerState<TicketScreen> {
  TicketDetail? _ticket;
  Object? _loadError;
  bool _gone = false;

  /// serverTime - deviceTime at the moment of the last fetch.
  int _clockOffsetMs = 0;

  Timer? _poll;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _fetch();
    _poll = Timer.periodic(const Duration(seconds: 4), (_) => _fetch());
    _tick = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (mounted && _ticket != null && !_ticket!.isCheckedIn) setState(() {});
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  int get _nowMs => DateTime.now().millisecondsSinceEpoch + _clockOffsetMs;

  Future<void> _fetch() async {
    try {
      final t = await ref.read(ticketsRepositoryProvider).fetchTicket(widget.ticketId);
      if (!mounted) return;
      setState(() {
        _clockOffsetMs = t.serverTime - DateTime.now().millisecondsSinceEpoch;
        _ticket = t;
        _loadError = null;
        _gone = false;
      });
      if (t.isCheckedIn) _poll?.cancel();
    } on ApiException catch (e) {
      if (!mounted) return;
      // After a transfer the old owner gets 404 "Ticket not found".
      if (_ticket != null && e.statusCode == 404) {
        setState(() => _gone = true);
        _poll?.cancel();
      } else if (_ticket == null) {
        setState(() => _loadError = e);
      }
    } catch (e) {
      if (mounted && _ticket == null) setState(() => _loadError = e);
    }
  }

  Future<void> _transfer() async {
    final done = await showTransferSheet(context, widget.ticketId);
    if (!done || !mounted) return;
    ref.invalidate(myTicketsProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ticket sent. It no longer works for you.')),
    );
    await _fetch();
  }

  @override
  Widget build(BuildContext context) {
    final t = _ticket;
    return Scaffold(
      appBar: const BataAppBar(title: 'Ticket', showBack: true),
      body: t == null
          ? (_loadError != null
                ? ErrorState(
                    message: 'Could not load this ticket.\n$_loadError',
                    onRetry: () {
                      setState(() => _loadError = null);
                      _fetch();
                    },
                  )
                : const Center(child: CircularProgressIndicator()))
          : _gone
          ? const _GoneState()
          : _content(t),
    );
  }

  Widget _content(TicketDetail t) {
    final p = context.palette;
    final art = t.tierImageUrl.isNotEmpty ? t.tierImageUrl : t.event.flyerUrl;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      children: [
        Container(
          decoration: BoxDecoration(
            color: p.card,
            border: Border.all(color: p.hairline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FlyerImage(url: art),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            t.event.name,
                            style: AppTypography.display(size: 20),
                          ),
                        ),
                        TicketBadge(
                          label: ticketStatusLabel(t.status),
                          color: ticketStatusColor(t.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    InfoLine(
                      icon: LucideIcons.calendar,
                      text: formatEventWhen(t.event.startsAt),
                    ),
                    const SizedBox(height: 4),
                    InfoLine(icon: LucideIcons.mapPin, text: t.event.venue),
                    const SizedBox(height: 4),
                    InfoLine(icon: LucideIcons.ticket, text: '${t.tierName}  ${t.code}'),
                  ],
                ),
              ),
              Divider(height: 1, color: p.hairline),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: _qrArea(t),
              ),
            ],
          ),
        ),
        if (t.canTransfer) ...[
          const SizedBox(height: AppSpacing.lg),
          SecondaryButton(
            label: 'Send to a friend',
            icon: LucideIcons.send,
            onPressed: _transfer,
          ),
        ],
      ],
    );
  }

  Widget _qrArea(TicketDetail t) {
    final p = context.palette;
    if (t.isCheckedIn) {
      final at = t.checkedInAt;
      return Column(
        children: [
          const Icon(LucideIcons.circleCheck, size: 64, color: AppColors.success),
          const SizedBox(height: AppSpacing.md),
          Text('Checked in', style: AppTypography.display(size: 22)),
          if (at != null) ...[
            const SizedBox(height: 4),
            Text(
              formatEventWhen(at),
              style: TextStyle(color: p.inkSecondary, fontSize: 13),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            'This ticket has been used and cannot be used again.',
            textAlign: TextAlign.center,
            style: TextStyle(color: p.inkSecondary, fontSize: 12),
          ),
        ],
      );
    }
    if (!t.isValid) {
      return Column(
        children: [
          Icon(LucideIcons.ban, size: 48, color: p.inkMuted),
          const SizedBox(height: AppSpacing.md),
          Text(
            'This ticket is no longer valid.',
            style: TextStyle(color: p.inkSecondary),
          ),
        ],
      );
    }

    final now = _nowMs;
    final text = buildTicketQrText(t.code, t.secret, now);
    final msLeft = ticketMsUntilNextStep(now);
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          color: Colors.white,
          child: QrImageView(
            data: text,
            size: 232,
            backgroundColor: Colors.white,
            errorCorrectionLevel: QrErrorCorrectLevel.M,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ClipRect(
          child: LinearProgressIndicator(
            value: msLeft / (ticketQrStepSeconds * 1000),
            minHeight: 3,
            backgroundColor: p.hairline,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Code refreshes in ${(msLeft / 1000).ceil()}s',
          style: AppTypography.label(size: 10, color: p.inkSecondary),
        ),
        const SizedBox(height: 4),
        Text(
          'Show this at the door. Screenshots stop working within a minute.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: p.inkMuted),
        ),
      ],
    );
  }
}

class _GoneState extends StatelessWidget {
  const _GoneState();

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.send, size: 40, color: p.inkMuted),
            const SizedBox(height: AppSpacing.md),
            Text(
              'This ticket is no longer yours',
              style: AppTypography.display(size: 18),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'It was sent to someone else, so it no longer works for you.',
              textAlign: TextAlign.center,
              style: TextStyle(color: p.inkSecondary),
            ),
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(
              label: 'Back to my tickets',
              expand: false,
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ],
        ),
      ),
    );
  }
}
