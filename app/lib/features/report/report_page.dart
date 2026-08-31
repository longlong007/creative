import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/session.dart';
import '../../widgets/common.dart';

class ReportPage extends StatefulWidget {
  const ReportPage({super.key, required this.decisionId});

  final String decisionId;

  @override
  State<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends State<ReportPage> {
  DecisionDetail? decision;
  String? error;
  String? selectedOption;
  final notes = TextEditingController();
  bool saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    notes.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final loaded = await context.read<SessionController>().getDecision(widget.decisionId);
    setState(() {
      decision = loaded;
      selectedOption = (loaded.workspace['recommendation'] as Map?)?['option_id'] as String?;
    });
  }

  Future<void> _record() async {
    setState(() => saving = true);
    try {
      final updated = await context.read<SessionController>().recordDecision(
            widget.decisionId,
            optionId: selectedOption,
            customChoice: selectedOption == null ? notes.text.trim() : null,
            notes: notes.text.trim(),
          );
      setState(() => decision = updated);
      if (mounted) {
        await showSnack(context, '已记录，将在 14 天后提醒复盘');
      }
    } catch (_) {
      setState(() => error = '记录失败，需先走到「建议」阶段');
    } finally {
      setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = decision;
    if (current == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final options = List<Map<String, dynamic>>.from(
      (current.workspace['options'] as List? ?? const []).map((e) => Map<String, dynamic>.from(e as Map)),
    );
    return Scaffold(
      appBar: AppBar(title: const Text('决策报告')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          StageBar(current: current.stage),
          const SizedBox(height: 12),
          if (error != null) ErrorBanner(message: error!),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: MarkdownBody(data: current.reportMarkdown.isEmpty ? '报告将在进入「建议」阶段后生成。' : current.reportMarkdown),
            ),
          ),
          const SizedBox(height: 16),
          if (current.status == 'active') ...[
            Text('记录你的最终选择', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final option in options)
              ListTile(
                title: Text(option['title'] as String? ?? ''),
                leading: Icon(
                  selectedOption == option['id'] ? Icons.radio_button_checked : Icons.radio_button_off,
                ),
                onTap: () => setState(() => selectedOption = option['id'] as String),
              ),
            TextField(
              controller: notes,
              maxLines: 3,
              decoration: const InputDecoration(labelText: '备注 / 自定义选择'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: saving ? null : _record,
              child: const Text('记录决策并安排复盘'),
            ),
          ] else ...[
            Text('已记录：${(current.workspace['recorded_choice'] as Map?)?['label'] ?? ''}'),
            if (current.reviewAt != null) Text('计划复盘：${current.reviewAt}'),
          ],
        ],
      ),
    );
  }
}
