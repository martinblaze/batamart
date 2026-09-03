import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:batamart/main.dart';

void main() {
  // Tests don't call main(), so the runtime-fetching guard there never
  // runs — set it here too, or this test hangs trying to reach
  // fonts.gstatic.com in any network-restricted environment (see README).
  GoogleFonts.config.allowRuntimeFetching = false;

  testWidgets('App boots and shows the API wiring check screen', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: BatamartApp()));

    expect(find.text('Batamart — API wiring check'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
