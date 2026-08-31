import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/session.dart';
import '../../widgets/common.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final email = TextEditingController();
  final password = TextEditingController();
  String? error;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => error = null);
    try {
      await context.read<SessionController>().login(email.text.trim(), password.text);
    } catch (_) {
      setState(() => error = context.read<SessionController>().error ?? '登录失败');
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = context.watch<SessionController>().busy;
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('DecideFlow', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 8),
                const Text('用对话走完一次认真的决策。'),
                const SizedBox(height: 24),
                if (error != null) ErrorBanner(message: error!),
                if (error != null) const SizedBox(height: 12),
                TextField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: '邮箱'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: '密码'),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: busy ? null : _submit,
                  child: busy ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('登录'),
                ),
                TextButton(
                  onPressed: () => context.go('/register'),
                  child: const Text('没有账号？注册'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
