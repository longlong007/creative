import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../state/session.dart';
import '../onboarding/onboarding_page.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionController>();
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        children: [
          ListTile(
            title: Text(session.user?.displayName ?? ''),
            subtitle: Text(session.user?.email ?? ''),
          ),
          ListTile(
            title: const Text('修改偏好'),
            subtitle: Text(_prefSummary(session.user?.preferences)),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const OnboardingPage()),
            ),
          ),
          ListTile(
            title: const Text('退出登录'),
            onTap: () async {
              await session.logout();
              if (context.mounted) {
                context.go('/login');
              }
            },
          ),
        ],
      ),
    );
  }
}

String _prefSummary(Preferences? prefs) {
  if (prefs == null) {
    return '';
  }
  return '${prefs.language} · ${prefs.tone} · ${prefs.categories.join(', ')}';
}
