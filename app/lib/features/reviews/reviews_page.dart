import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/session.dart';
import '../../widgets/common.dart';

class ReviewsPage extends StatefulWidget {
  const ReviewsPage({super.key});

  @override
  State<ReviewsPage> createState() => _ReviewsPageState();
}

class _ReviewsPageState extends State<ReviewsPage> {
  late Future<List<DecisionSummary>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<SessionController>().dueReviews();
  }

  Future<void> _complete(DecisionSummary item) async {
    final notes = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('复盘：${item.title}'),
        content: TextField(
          controller: notes,
          maxLines: 4,
          decoration: const InputDecoration(hintText: '假设还成立吗？实际结果如何？'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('完成复盘')),
        ],
      ),
    );
    if (ok != true || !mounted) {
      return;
    }
    await context.read<SessionController>().completeReview(item.id, notes.text.trim());
    setState(() => _future = context.read<SessionController>().dueReviews());
    if (mounted) {
      await showSnack(context, '复盘已保存');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('到期复盘')),
      body: FutureBuilder(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final items = snapshot.data!;
          if (items.isEmpty) {
            return const Center(child: Text('暂时没有到期的复盘。'));
          }
          return ListView(
            children: [
              for (final item in items)
                ListTile(
                  title: Text(item.title),
                  subtitle: Text('原定 ${item.reviewAt ?? ''}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () async {
                    await context.push('/decisions/${item.id}/report');
                    if (mounted) {
                      await _complete(item);
                    }
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}
