import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/config.dart';
import '../models/models.dart';

class SessionController extends ChangeNotifier {
  SessionController({Dio? dio})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: '$apiBase/api/v1',
                connectTimeout: const Duration(seconds: 20),
                receiveTimeout: const Duration(seconds: 60),
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  static const _tokenKey = 'access_token';

  String? token;
  UserProfile? user;
  String? error;
  bool busy = false;

  bool get isLoggedIn => token != null && token!.isNotEmpty;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    token = prefs.getString(_tokenKey);
    if (token == null) {
      return;
    }
    try {
      await refreshMe();
    } catch (_) {
      await logout();
    }
  }

  Future<void> register(String email, String password, String name) async {
    await _auth('/auth/register', {
      'email': email,
      'password': password,
      'display_name': name,
    });
  }

  Future<void> login(String email, String password) async {
    await _auth('/auth/login', {'email': email, 'password': password});
  }

  Future<void> _auth(String path, Map<String, dynamic> body) async {
    _setBusy(true);
    try {
      final response = await _dio.post(path, data: body);
      token = response.data['access_token'] as String;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token!);
      await refreshMe();
    } on DioException catch (e) {
      error = _dioMessage(e);
      notifyListeners();
      rethrow;
    } finally {
      _setBusy(false);
    }
  }

  Future<void> refreshMe() async {
    final response = await _dio.get('/auth/me');
    user = UserProfile.fromJson(Map<String, dynamic>.from(response.data as Map));
    notifyListeners();
  }

  Future<void> savePreferences(Preferences preferences) async {
    _setBusy(true);
    try {
      final response = await _dio.put('/users/me/preferences', data: preferences.toJson());
      user = UserProfile.fromJson(Map<String, dynamic>.from(response.data as Map));
      notifyListeners();
    } finally {
      _setBusy(false);
    }
  }

  Future<List<DecisionTemplate>> templates({String? category}) async {
    final response = await _dio.get(
      '/templates',
      queryParameters: {'category': ?category},
    );
    return [
      for (final item in response.data as List)
        DecisionTemplate.fromJson(Map<String, dynamic>.from(item as Map)),
    ];
  }

  Future<List<DecisionSummary>> decisions() async {
    final response = await _dio.get('/decisions');
    return [
      for (final item in response.data as List)
        DecisionSummary.fromJson(Map<String, dynamic>.from(item as Map)),
    ];
  }

  Future<List<DecisionSummary>> dueReviews() async {
    final response = await _dio.get('/reviews/due');
    return [
      for (final item in response.data as List)
        DecisionSummary.fromJson(Map<String, dynamic>.from(item as Map)),
    ];
  }

  Future<DecisionDetail> createDecision({
    String? title,
    String? category,
    String? templateId,
    String? problem,
  }) async {
    final response = await _dio.post('/decisions', data: {
      'title': ?title,
      'category': ?category,
      'template_id': ?templateId,
      'problem': ?problem,
    });
    return DecisionDetail.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<DecisionDetail> getDecision(String id) async {
    final response = await _dio.get('/decisions/$id');
    return DecisionDetail.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<DecisionDetail> sendMessage(String id, String content) async {
    final response = await _dio.post('/decisions/$id/messages', data: {'content': content});
    return DecisionDetail.fromJson(
      Map<String, dynamic>.from(response.data['decision'] as Map),
    );
  }

  Future<DecisionDetail> recordDecision(
    String id, {
    String? optionId,
    String? customChoice,
    String? notes,
    int reviewInDays = 14,
  }) async {
    final response = await _dio.post('/decisions/$id/record', data: {
      'option_id': optionId,
      'custom_choice': customChoice,
      'notes': notes,
      'review_in_days': reviewInDays,
    });
    return DecisionDetail.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<DecisionDetail> completeReview(String id, String notes) async {
    final response = await _dio.post('/reviews/$id/complete', data: {'notes': notes});
    return DecisionDetail.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<void> logout() async {
    token = null;
    user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    notifyListeners();
  }

  void _setBusy(bool value) {
    busy = value;
    if (value) {
      error = null;
    }
    notifyListeners();
  }
}

String _dioMessage(DioException e) {
  final data = e.response?.data;
  if (data is Map && data['detail'] != null) {
    return data['detail'].toString();
  }
  return e.message ?? '网络错误';
}
