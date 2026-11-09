import 'package:batamart/features/tickets/data/ticket_qr.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('matches the known-answer vector from docs/TICKETING.md', () {
    expect(
      buildTicketQrText('BT-ABCDEFGH', 'secret', 1700000000000),
      'BT1.BT-ABCDEFGH.56666666.1fc8d6f136d3cdff',
    );
  });

  test('step and countdown follow 30 second boundaries', () {
    expect(ticketQrStepOf(1700000000000), 56666666);
    expect(ticketMsUntilNextStep(1700000000000), 10000);
    expect(ticketQrStepOf(1700000000000 + 10000), 56666667);
  });
}
