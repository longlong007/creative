import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'features/auth/login_page.dart';
import 'features/auth/register_page.dart';
import 'features/chat/chat_page.dart';
import 'features/home/home_page.dart';
import 'features/onboarding/onboarding_page.dart';
import 'features/report/report_page.dart';
import 'features/reviews/reviews_page.dart';
import 'features/settings/settings_page.dart';
import 'features/templates/templates_page.dart';
import 'state/session.dart';

class DecideFlowApp extends StatefulWidget {
  const DecideFlowApp({super.key});

  @override
  State<DecideFlowApp> createState() => _DecideFlowAppState();
}

class _DecideFlowAppState extends State<DecideFlowApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final session = context.read<SessionController>();
    _router = GoRouter(
      initialLocation: '/home',
      refreshListenable: session,
      redirect: (context, state) {
        final loggedIn = session.isLoggedIn;
        final onboarding = session.user?.onboardingDone ?? false;
        final loc = state.matchedLocation;
        final authRoute = loc == '/login' || loc == '/register';
        if (!loggedIn) {
          return authRoute ? null : '/login';
        }
        if (!onboarding && loc != '/onboarding') {
          return '/onboarding';
        }
        if (onboarding && (authRoute || loc == '/onboarding')) {
          return '/home';
        }
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (c, s) => const LoginPage()),
        GoRoute(path: '/register', builder: (c, s) => const RegisterPage()),
        GoRoute(path: '/onboarding', builder: (c, s) => const OnboardingPage()),
        GoRoute(path: '/home', builder: (c, s) => const HomePage()),
        GoRoute(path: '/templates', builder: (c, s) => const TemplatesPage()),
        GoRoute(
          path: '/decisions/:id',
          builder: (c, s) => ChatPage(decisionId: s.pathParameters['id']!),
        ),
        GoRoute(
          path: '/decisions/:id/report',
          builder: (c, s) => ReportPage(decisionId: s.pathParameters['id']!),
        ),
        GoRoute(path: '/reviews', builder: (c, s) => const ReviewsPage()),
        GoRoute(path: '/settings', builder: (c, s) => const SettingsPage()),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'DecideFlow 决断助手',
      theme: decideTheme,
      routerConfig: _router,
    );
  }
}
