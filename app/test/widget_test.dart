import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:decideflow/models/models.dart';
import 'package:decideflow/widgets/common.dart';

void main() {
  testWidgets('StageBar highlights stages up to current', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: StageBar(current: 'evaluate')),
      ),
    );
    expect(find.text('澄清'), findsOneWidget);
    expect(find.text('评估'), findsOneWidget);
    expect(stageOrder.indexOf('evaluate'), 3);
  });

  test('Preferences round-trip json', () {
    final prefs = Preferences(
      language: 'en',
      tone: 'concise',
      categories: ['career'],
      riskTolerance: 'low',
      decisionSpeed: 'fast',
    );
    final copy = Preferences.fromJson(prefs.toJson());
    expect(copy.language, 'en');
    expect(copy.categories, ['career']);
    expect(copy.decisionSpeed, 'fast');
  });
}
