# DecideFlow 决断助手

跨平台（iOS / Android / Web）决策辅助 MVP：注册登录 → 填写偏好 → 选模板或自填问题 → AI 按阶段引导对话 → 生成报告并记录决策 → 到期复盘。

后端用 FastAPI；知识库默认写入本地向量，配置 `PINECONE_API_KEY` + `OPENAI_API_KEY` 后走 Pinecone 与真实 LLM。无密钥时使用启发式教练 + 哈希嵌入，流程仍可跑通。

## 结构

- `app/` Flutter 客户端
- `backend/` API、领域状态机、RAG、知识库种子
- `docs/superpowers/` 设计规格

## 后端

```bash
cd backend
python3 -m pip install -r requirements.txt
cp .env.example .env
python3 -m pytest
python3 -m uvicorn app.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

可选环境变量：`OPENAI_API_KEY`、`PINECONE_API_KEY`、`TAVILY_API_KEY`。重新入库：

```bash
python3 scripts/ingest.py
```

## Flutter

```bash
cd app
flutter pub get
flutter test
flutter run -d chrome --dart-define=API_BASE=http://localhost:8000
# 或 iOS / Android 模拟器
```

Web 与后端不在同一源时，后端默认 `CORS_ORIGINS=*`。

## 核心流程

1. 澄清问题  
2. 收集约束与事实（可联网）  
3. 生成选项  
4. 评估（默认加权评分，并引用知识库框架）  
5. 建议并生成 Markdown 报告  
6. 用户记录选择，默认 14 天后进入复盘列表  

原始对话、工作区 JSON、报告都会落库。
