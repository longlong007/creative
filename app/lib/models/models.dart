class UserProfile {
  UserProfile({
    required this.id,
    required this.email,
    required this.displayName,
    required this.onboardingDone,
    required this.preferences,
  });

  final String id;
  final String email;
  final String displayName;
  final bool onboardingDone;
  final Preferences preferences;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      email: json['email'] as String,
      displayName: json['display_name'] as String? ?? '',
      onboardingDone: json['onboarding_done'] as bool? ?? false,
      preferences: Preferences.fromJson(
        Map<String, dynamic>.from(json['preferences'] as Map? ?? {}),
      ),
    );
  }
}

class Preferences {
  Preferences({
    this.language = 'zh',
    this.tone = 'warm',
    this.categories = const ['life'],
    this.riskTolerance = 'medium',
    this.decisionSpeed = 'balanced',
  });

  String language;
  String tone;
  List<String> categories;
  String riskTolerance;
  String decisionSpeed;

  factory Preferences.fromJson(Map<String, dynamic> json) {
    return Preferences(
      language: json['language'] as String? ?? 'zh',
      tone: json['tone'] as String? ?? 'warm',
      categories: List<String>.from(json['categories'] as List? ?? const ['life']),
      riskTolerance: json['risk_tolerance'] as String? ?? 'medium',
      decisionSpeed: json['decision_speed'] as String? ?? 'balanced',
    );
  }

  Map<String, dynamic> toJson() => {
        'language': language,
        'tone': tone,
        'categories': categories,
        'risk_tolerance': riskTolerance,
        'decision_speed': decisionSpeed,
      };

  Preferences copy() => Preferences.fromJson(toJson());
}

class DecisionTemplate {
  DecisionTemplate({
    required this.id,
    required this.category,
    required this.title,
    required this.prompt,
    required this.suggestedCriteria,
  });

  final String id;
  final String category;
  final String title;
  final String prompt;
  final List<String> suggestedCriteria;

  factory DecisionTemplate.fromJson(Map<String, dynamic> json) {
    return DecisionTemplate(
      id: json['id'] as String,
      category: json['category'] as String,
      title: json['title'] as String,
      prompt: json['prompt'] as String,
      suggestedCriteria: List<String>.from(json['suggested_criteria'] as List? ?? const []),
    );
  }
}

class DecisionSummary {
  DecisionSummary({
    required this.id,
    required this.title,
    required this.category,
    required this.stage,
    required this.status,
    this.reviewAt,
    this.updatedAt,
  });

  final String id;
  final String title;
  final String category;
  final String stage;
  final String status;
  final DateTime? reviewAt;
  final DateTime? updatedAt;

  factory DecisionSummary.fromJson(Map<String, dynamic> json) {
    return DecisionSummary(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? 'life',
      stage: json['stage'] as String,
      status: json['status'] as String,
      reviewAt: _parseDate(json['review_at']),
      updatedAt: _parseDate(json['updated_at']),
    );
  }
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.stage,
    this.extra = const {},
  });

  final String id;
  final String role;
  final String content;
  final String stage;
  final Map<String, dynamic> extra;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      role: json['role'] as String,
      content: json['content'] as String,
      stage: json['stage'] as String,
      extra: Map<String, dynamic>.from(json['extra'] as Map? ?? {}),
    );
  }
}

class DecisionDetail {
  DecisionDetail({
    required this.id,
    required this.title,
    required this.category,
    required this.stage,
    required this.status,
    required this.workspace,
    required this.reportMarkdown,
    required this.messages,
    this.reviewAt,
    this.reviewNotes = '',
  });

  final String id;
  final String title;
  final String category;
  final String stage;
  final String status;
  final Map<String, dynamic> workspace;
  final String reportMarkdown;
  final List<ChatMessage> messages;
  final DateTime? reviewAt;
  final String reviewNotes;

  factory DecisionDetail.fromJson(Map<String, dynamic> json) {
    return DecisionDetail(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? 'life',
      stage: json['stage'] as String,
      status: json['status'] as String,
      workspace: Map<String, dynamic>.from(json['workspace'] as Map? ?? {}),
      reportMarkdown: json['report_markdown'] as String? ?? '',
      reviewAt: _parseDate(json['review_at']),
      reviewNotes: json['review_notes'] as String? ?? '',
      messages: [
        for (final item in json['messages'] as List? ?? const [])
          ChatMessage.fromJson(Map<String, dynamic>.from(item as Map)),
      ],
    );
  }
}

DateTime? _parseDate(dynamic value) {
  if (value is! String || value.isEmpty) {
    return null;
  }
  return DateTime.tryParse(value);
}

const stageLabels = {
  'clarify': '澄清',
  'collect': '收集',
  'options': '选项',
  'evaluate': '评估',
  'recommend': '建议',
  'recorded': '已记录',
};

const stageOrder = [
  'clarify',
  'collect',
  'options',
  'evaluate',
  'recommend',
  'recorded',
];
