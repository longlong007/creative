import 'package:flutter/material.dart';

import '../models/models.dart';

class StageBar extends StatelessWidget {
  const StageBar({super.key, required this.current});

  final String current;

  @override
  Widget build(BuildContext context) {
    final index = stageOrder.indexOf(current);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < stageOrder.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(
                label: Text(stageLabels[stageOrder[i]] ?? stageOrder[i]),
                selected: i <= index,
                visualDensity: VisualDensity.compact,
              ),
            ),
        ],
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(message, style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer)),
      ),
    );
  }
}

Future<void> showSnack(BuildContext context, String message) {
  return ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(message)))
      .closed;
}
