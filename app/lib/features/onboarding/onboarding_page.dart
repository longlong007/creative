import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/session.dart';
import '../../widgets/common.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  late Preferences prefs;
  String? error;

  static const categoryLabels = {
    'career': '职业',
    'finance': '财务',
    'health': '健康',
    'relationship': '关系',
    'purchase': '购买',
    'life': '生活',
  };

  @override
  void initState() {
    super.initState();
    prefs = context.read<SessionController>().user?.preferences.copy() ?? Preferences();
  }

  Future<void> _save() async {
    if (prefs.categories.isEmpty) {
      setState(() => error = '请至少选择一个关注类别');
      return;
    }
    try {
      await context.read<SessionController>().savePreferences(prefs);
      if (mounted && Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } catch (_) {
      setState(() => error = '保存失败');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('你的决策偏好')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('这些信息会决定 AI 的语气、推荐的问题模板，以及评估时如何谈风险。'),
          const SizedBox(height: 16),
          if (error != null) ErrorBanner(message: error!),
          const SizedBox(height: 8),
          const Text('语言'),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('中文'),
                selected: prefs.language == 'zh',
                onSelected: (_) => setState(() => prefs.language = 'zh'),
              ),
              ChoiceChip(
                label: const Text('English'),
                selected: prefs.language == 'en',
                onSelected: (_) => setState(() => prefs.language = 'en'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('语气'),
          Wrap(
            spacing: 8,
            children: [
              for (final item in [
                ('warm', '温暖'),
                ('professional', '专业'),
                ('concise', '简洁'),
                ('socratic', '追问'),
              ])
                ChoiceChip(
                  label: Text(item.$2),
                  selected: prefs.tone == item.$1,
                  onSelected: (_) => setState(() => prefs.tone = item.$1),
                ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('关注类别'),
          Wrap(
            spacing: 8,
            children: [
              for (final entry in categoryLabels.entries)
                FilterChip(
                  label: Text(entry.value),
                  selected: prefs.categories.contains(entry.key),
                  onSelected: (selected) {
                    setState(() {
                      if (selected) {
                        prefs.categories = [...prefs.categories, entry.key];
                      } else {
                        prefs.categories = prefs.categories.where((c) => c != entry.key).toList();
                      }
                    });
                  },
                ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('风险偏好'),
          Wrap(
            spacing: 8,
            children: [
              for (final item in [('low', '保守'), ('medium', '均衡'), ('high', '进取')])
                ChoiceChip(
                  label: Text(item.$2),
                  selected: prefs.riskTolerance == item.$1,
                  onSelected: (_) => setState(() => prefs.riskTolerance = item.$1),
                ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('决策节奏'),
          Wrap(
            spacing: 8,
            children: [
              for (final item in [('careful', '谨慎'), ('balanced', '适中'), ('fast', '尽快')])
                ChoiceChip(
                  label: Text(item.$2),
                  selected: prefs.decisionSpeed == item.$1,
                  onSelected: (_) => setState(() => prefs.decisionSpeed = item.$1),
                ),
            ],
          ),
          const SizedBox(height: 28),
          FilledButton(onPressed: _save, child: const Text('开始使用')),
        ],
      ),
    );
  }
}
