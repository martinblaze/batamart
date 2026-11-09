import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Seconds a QR code stays valid. Must match QR_STEP_SECONDS in
/// lib/tickets/config.ts.
const int ticketQrStepSeconds = 30;

/// The rotating ticket QR, identical to lib/tickets/qr.ts:
///
///   step = floor(unixSeconds / 30)
///   mac  = first 8 bytes (16 lowercase hex chars) of
///          HMAC-SHA256(key = UTF-8(secret), msg = "$code.$step")
///   text = "BT1.$code.$step.$mac"
int ticketQrStepOf(int nowMs) => nowMs ~/ 1000 ~/ ticketQrStepSeconds;

/// Milliseconds until the current code is replaced.
int ticketMsUntilNextStep(int nowMs) =>
    (ticketQrStepOf(nowMs) + 1) * ticketQrStepSeconds * 1000 - nowMs;

String buildTicketQrText(String code, String secret, int nowMs) {
  final step = ticketQrStepOf(nowMs);
  final digest = Hmac(
    sha256,
    utf8.encode(secret),
  ).convert(utf8.encode('$code.$step'));
  final mac = digest.bytes
      .take(8)
      .map((b) => b.toRadixString(16).padLeft(2, '0'))
      .join();
  return 'BT1.$code.$step.$mac';
}
