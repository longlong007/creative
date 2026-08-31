import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/session.dart';

class TemplatesPage extends StatefulWidget {
  const TemplatesPage({super.key});

  @override
  State<TemplatesPage> createState() => _TemplatesPageState();
}

class _TemplatesPageState extends State<TemplatesPage> {
  late Future<List<DecisionTemplate>> _future;
  final custom = TextEditingController();

  @override
  void initState() {
    super.initState();
    _future = context.read<SessionController>().templates();
  }

  @override
  void dispose() {
    custom.dispose();
    super.dispose();
  }

  Future<void> _open({DecisionTemplate? template, String? problem}) async {
    final decision = await context.read<SessionController>().createDecision(
          templateId: template?.id,
          category: template?.category,
          title: template?.title,
          problem: problem ?? template?.prompt,
        );
    if (!mounted) {
      return;
    }
    context.push('/decisions/${decision.id}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('选择问题')),
      body: FutureBuilder(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final templates = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextField(
                controller: custom,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: '或自己写决策问题',
                  hintText: '例如：要不要接受这个 offer？',
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () {
                  final text = custom.text.trim();
                  if (text.isEmpty) {
                    return;
                  }
                  _open(problem: text);
                },
                child: const Text('用自定义问题开始'),
              ),
              const SizedBox(height: 20),
              Text('推荐模板', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              for (final template in templates)
                Card(
                  child: ListTile(
                    title: Text(template.title),
                    subtitle: Text(template.prompt),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _open(template: template),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
