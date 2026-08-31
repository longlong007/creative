import 'package:flutter/material.dart';

final decideTheme = ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF1F6F6A),
    brightness: Brightness.light,
  ),
  useMaterial3: true,
  visualDensity: VisualDensity.standard,
  inputDecorationTheme: const InputDecorationTheme(
    border: OutlineInputBorder(),
  ),
);
