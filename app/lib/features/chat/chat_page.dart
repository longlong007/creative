import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/session.dart';
import '../../widgets/common.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key, required this.decisionId});

  final String decisionId;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  DecisionDetail? decision;
  String? error;
  bool sending = false;
  final input = TextEditingController();
  final scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final loaded = await context.read<SessionController>().getDecision(widget.decisionId);
      setState(() => decision = loaded);
      _jumpToEnd();
    } catch (e) {
      setState(() => error = e.toString());
    }
  }

  void _jumpToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients) {
        scroll.jumpTo(scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send() async {
    final text = input.text.trim();
    if (text.isEmpty || sending || decision == null) {
      return;
    }
    setState(() {
      sending = true;
      error = null;
    });
    input.clear();
    try {
      final updated = await context.read<SessionController>().sendMessage(widget.decisionId, text);
      setState(() => decision = updated);
      _jumpToEnd();
    } catch (e) {
      input.text = text;
      setState(() => error = '发送失败，请重试');
    } finally {
      setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = decision;
    return Scaffold(
      appBar: AppBar(
        title: Text(current?.title.isNotEmpty == true ? current!.title : '决策对话'),
        actions: [
          if (current?.stage == 'recommend' || current?.status != 'active')
            TextButton(
              onPressed: () => context.push('/decisions/${widget.decisionId}/report'),
              child: const Text('报告'),
            ),
        ],
      ),
      body: current == null
          ? Center(child: error == null ? const CircularProgressIndicator() : ErrorBanner(message: error!))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                  child: StageBar(current: current.stage),
                ),
                if (error != null) ErrorBanner(message: error!),
                Expanded(
                  child: ListView.builder(
                    controller: scroll,
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    itemCount: current.messages.length,
                    itemBuilder: (context, index) {
                      final message = current.messages[index];
                      final mine = message.role == 'user';
                      return Align(
                        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          padding: const EdgeInsets.all(12),
                          constraints: const BoxConstraints(maxWidth: 640),
                          decoration: BoxDecoration(
                            color: mine
                                ? Theme.of(context).colorScheme.primaryContainer
                                : Theme.of(context).colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(message.content),
                        ),
                      );
                    },
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: current.status != 'active'
                        ? FilledButton(
                            onPressed: () => context.push('/decisions/${widget.decisionId}/report'),
                            child: const Text('查看已记录的报告'),
                          )
                        : Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: input,
                                  minLines: 1,
                                  maxLines: 4,
                                  enabled: !sending,
                                  decoration: const InputDecoration(hintText: '输入你的回答或补充信息'),
                                  onSubmitted: (_) => _send(),
                                ),
                              ),
                              const SizedBox(width: 8),
                              IconButton.filled(
                                onPressed: sending ? null : _send,
                                icon: sending
                                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                    : const Icon(Icons.send),
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}
