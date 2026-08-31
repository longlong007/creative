import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/session.dart';
import '../../widgets/common.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<_HomeData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_HomeData> _load() async {
    final session = context.read<SessionController>();
    final decisions = await session.decisions();
    final due = await session.dueReviews();
    return _HomeData(decisions: decisions, due: due);
  }

  @override
  Widget build(BuildContext context) {
    final name = context.watch<SessionController>().user?.displayName ?? '';
    return Scaffold(
      appBar: AppBar(
        title: Text(name.isEmpty ? '决断助手' : '你好，$name'),
        actions: [
          IconButton(
            tooltip: '复盘',
            onPressed: () => context.push('/reviews'),
            icon: const Icon(Icons.replay),
          ),
          IconButton(
            tooltip: '偏好',
            onPressed: () => context.push('/settings'),
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/templates'),
        icon: const Icon(Icons.add),
        label: const Text('新决策'),
      ),
      body: FutureBuilder<_HomeData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: ErrorBanner(message: snapshot.error.toString()));
          }
          final data = snapshot.data!;
          final active = data.decisions.where((d) => d.status == 'active').toList();
          final recorded = data.decisions.where((d) => d.status != 'active').toList();
          return RefreshIndicator(
            onRefresh: () async {
              setState(() => _future = _load());
              await _future;
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 88),
              children: [
                if (data.due.isNotEmpty)
                  Card(
                    color: Theme.of(context).colorScheme.tertiaryContainer,
                    child: ListTile(
                      title: Text('有 ${data.due.length} 条决策该复盘了'),
                      subtitle: const Text('回顾当时的假设是否还成立'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/reviews'),
                    ),
                  ),
                const SizedBox(height: 12),
                Text('进行中', style: Theme.of(context).textTheme.titleMedium),
                if (active.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('还没有进行中的决策。')),
                for (final item in active) _DecisionTile(item: item),
                const SizedBox(height: 16),
                Text('已记录', style: Theme.of(context).textTheme.titleMedium),
                if (recorded.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('记录完成后会出现在这里。')),
                for (final item in recorded) _DecisionTile(item: item),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HomeData {
  _HomeData({required this.decisions, required this.due});
  final List<DecisionSummary> decisions;
  final List<DecisionSummary> due;
}

class _DecisionTile extends StatelessWidget {
  const _DecisionTile({required this.item});
  final DecisionSummary item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(item.title.isEmpty ? '未命名决策' : item.title),
        subtitle: Text('${stageLabels[item.stage] ?? item.stage} · ${item.category}'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          if (item.stage == 'recommend' || item.status != 'active') {
            context.push('/decisions/${item.id}/report');
          } else {
            context.push('/decisions/${item.id}');
          }
        },
      ),
    );
  }
}
