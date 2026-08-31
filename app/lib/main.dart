import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'state/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = SessionController();
  await session.restore();
  runApp(
    ChangeNotifierProvider.value(
      value: session,
      child: const DecideFlowApp(),
    ),
  );
}
