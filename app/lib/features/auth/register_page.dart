import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/session.dart';
import '../../widgets/common.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  String? error;

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => error = null);
    if (password.text.length < 8) {
      setState(() => error = '密码至少 8 位');
      return;
    }
    try {
      await context.read<SessionController>().register(
            email.text.trim(),
            password.text,
            name.text.trim(),
          );
    } catch (_) {
      setState(() => error = context.read<SessionController>().error ?? '注册失败');
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = context.watch<SessionController>().busy;
    return Scaffold(
      appBar: AppBar(title: const Text('注册')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                if (error != null) ErrorBanner(message: error!),
                const SizedBox(height: 12),
                TextField(controller: name, decoration: const InputDecoration(labelText: '称呼')),
                const SizedBox(height: 12),
                TextField(controller: email, decoration: const InputDecoration(labelText: '邮箱')),
                const SizedBox(height: 12),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: '密码（至少 8 位）'),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: busy ? null : _submit,
                  child: const Text('创建账号'),
                ),
                TextButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('已有账号？登录'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
