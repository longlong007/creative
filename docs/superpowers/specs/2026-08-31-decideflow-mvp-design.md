# DecideFlow MVP 设计规格

产品名：**DecideFlow（决断助手）**。Flutter 客户端（iOS / Android / Web）+ FastAPI 后端。核心是用对话引导用户走完决策流程，AI 参考 RAG 知识库（Pinecone，本地可回退）并可联网检索。

本规格只覆盖 MVP。架构用接口隔离外部依赖，便于后续换成 Postgres、真实 LLM、运营后台等。

## 1. 目标与非目标

**目标（一次完整闭环）：**

1. 注册 / 登录。
2. 填写偏好：语言、语气、关注类别、风险偏好、决策节奏。
3. 选问题模板或自填决策问题。
4. AI 按阶段引导：澄清问题 → 收集信息 → 生成选项 → 评估 → 建议 → 用户记录决策。
5. 保存偏好、完整原始对话、结构化工作区、决策报告。
6. 到期复盘提醒（应用内列表；移动端后续可接本地通知）。

**非目标（明确不做）：**

- 支付、社交分享、多人协作、语音、管理后台、知识库运营 UI。
- 原生推送服务、多租户、SSO、OAuth。
- 完整书籍原文入库（版权）。知识库只放**原创**的方法摘要。

## 2. 架构

```
Flutter (iOS / Android / Web)
        │  HTTPS JSON
        ▼
FastAPI  ── Auth / Preferences / Templates / Decisions / Chat / Reviews
        │
        ├── SQLAlchemy（默认 SQLite；DATABASE_URL 可切 Postgres）
        ├── LLMPort（OpenAI 兼容；无密钥则 HeuristicCoach）
        ├── EmbedderPort（OpenAI embeddings；无密钥则稳定哈希向量）
        ├── VectorStorePort（Pinecone；无密钥则本地 JSON+余弦）
        └── WebSearchPort（Tavily；无密钥则跳过联网）
```

客户端不直连 Pinecone / LLM。所有对话、检索、报告都在后端，便于审计和演进。

分层：

- `app/api`：HTTP、鉴权、DTO。
- `app/domain`：阶段状态机、报告生成、启发式教练（无 I/O）。
- `app/services`：LLM、RAG、向量库、联网、嵌入。
- `app/models`：持久化。

## 3. 核心领域

### 3.1 决策阶段

单向状态机，只允许前进（MVP 不做回退 UI，数据层预留 `stage` 字段即可改）：

| 阶段 | 职责 |
|------|------|
| `clarify` | 把模糊问题变成可决策的问题：目标、成功标准、时间范围 |
| `collect` | 收集约束、事实、利益相关者、不可逆点 |
| `options` | 生成 3–5 个互斥/可比较选项 |
| `evaluate` | 用标准给选项打分（默认加权评分，可引用知识库其他框架） |
| `recommend` | 给出建议、理由、风险、需跟踪的假设 |
| `recorded` | 用户确认最终选择并写入记录 |

完成后设置 `review_at`（默认 14 天后）。复盘完成后 `status=reviewed`。

### 3.2 工作区（结构化，与对话分离）

每条决策同时存：

- **原始对话** `messages[]`：role、content、stage、时间、metadata（检索片段、联网结果）。
- **工作区 JSON**：`problem_statement`、`criteria[]`、`constraints[]`、`options[]`、`recommendation`、`recorded_choice`。
- **报告** `report_markdown`：在进入 `recommend` 时生成，记录决策时再固化一版。

对话是事实源；工作区是给 UI / 报告 / 后续模型用的投影。

### 3.3 用户偏好

| 字段 | 取值 | 用途 |
|------|------|------|
| `language` | `zh` / `en` | 回复语言 |
| `tone` | `professional` / `warm` / `concise` / `socratic` | 交互风格 |
| `categories` | `career` `finance` `health` `relationship` `purchase` `life` 多选 | 推荐模板 |
| `risk_tolerance` | `low` / `medium` / `high` | 建议时的风险措辞 |
| `decision_speed` | `careful` / `balanced` / `fast` | 每阶段提问深度 |

注册后强制走完 onboarding 才进首页。

### 3.4 问题模板

静态目录（后端常量，后续可迁数据库）：

- 职业：换工作、是否接受 offer、是否创业
- 财务：大额消费、投资/储蓄分配
- 健康：是否开始某项治疗/习惯（非医疗诊断，仅决策框架）
- 关系：是否沟通/边界（非心理治疗）
- 购买：买房/买车/电子产品
- 生活：搬家、时间分配

模板含：标题、引导问题、建议评估标准。用户也可「空白问题」直接开聊。

## 4. API（MVP）

前缀 `/api/v1`。除 register/login 外均需 `Authorization: Bearer <jwt>`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | `{email, password, display_name}` |
| POST | `/auth/login` | `{email, password}` → `{access_token}` |
| GET | `/auth/me` | 当前用户 + 偏好 |
| PUT | `/users/me/preferences` | 更新偏好 |
| GET | `/templates` | 可按 `category` 过滤；登录后按偏好排序 |
| POST | `/decisions` | `{title?, category?, template_id?, problem?}` 创建并进入 clarify |
| GET | `/decisions` | 列表 |
| GET | `/decisions/{id}` | 详情：工作区 + 消息 + 报告 |
| POST | `/decisions/{id}/messages` | `{content}` → 助手回复 + 可能的阶段变更 |
| POST | `/decisions/{id}/record` | `{option_id?, custom_choice?, notes?}` 记录决策并排期复盘 |
| GET | `/decisions/{id}/report` | 报告 markdown + 结构化字段 |
| GET | `/reviews/due` | `review_at <= now` 且已记录未复盘 |
| POST | `/reviews/{decision_id}/complete` | `{notes}` |

错误：`401` 未登录，`404` 资源不存在或不属于当前用户，`409` 非法阶段操作，`422` 校验失败。

聊天 MVP 用请求-响应 JSON，不实现 SSE（接口形状允许日后加 `stream=true`）。

## 5. RAG 与联网

### 知识库

`backend/knowledge/*.md`，每篇一个决策框架（原创摘要，约 400–800 字）。启动时若向量库为空则自动 ingest。

框架清单（MVP）：加权评分、10/10/10、预验尸（pre-mortem）、遗憾最小化、逆向思考、机会成本、第二层后果、OODA、Cynefin 简版、WRAP 式四核对（原创表述，不摘录原书）。

### 检索

每次用户消息：用问题+最近对话嵌入，top-k=4。片段进入 prompt / 启发式教练，并写入该条 assistant message 的 metadata。

### 向量库

`VectorStorePort.query / upsert`。`PINECONE_API_KEY` 存在则用 Pinecone（index 名 `decideflow-knowledge`，维度与 embedder 一致）；否则 `data/local_vectors.json`。

### 嵌入

`OPENAI_API_KEY` → `text-embedding-3-small`（1536 维）。否则哈希嵌入 256 维。两种模式不要混用同一 Pinecone index；本地模式永远走本地库。

### 联网

`TAVILY_API_KEY` 存在且当前阶段为 `collect` 或 `evaluate` 时，教练可调用一次检索。失败则静默跳过，不阻断对话。

### LLM

`OPENAI_API_KEY` 存在则走 OpenAI Chat Completions + tool calling（`rag_search` 已在服务层预检索；模型可再搜、可 `web_search`、可 `update_workspace`、可 `advance_stage`）。无密钥则 `HeuristicCoach`：按阶段用模板提问，用检索到的框架名点明方法，根据用户文本抽标准/选项，加权评分后给建议。

## 6. 客户端信息架构

路由：

- `/login` `/register`
- `/onboarding`（未完成偏好则强制）
- `/home`：新决策、进行中、到期复盘
- `/templates`：分类模板 + 自定义
- `/decisions/:id`：对话。顶部阶段条；底部输入
- `/decisions/:id/report`：报告 + 记录决策表单
- `/reviews`：到期复盘列表与提交
- `/settings`：改偏好

主题：Material 3，浅色，中文为默认 UI 文案（内容语言跟偏好走）。

状态：`shared_preferences` 存 JWT；`Provider` 持有 session / 当前决策。

API base：`--dart-define=API_BASE=http://localhost:8000`，Web 默认 `http://localhost:8000`。

## 7. 安全与数据

- 密码：bcrypt（或等价单向哈希）。
- JWT：HS256，过期 7 天（MVP）。
- 用户只能读写自己的决策。
- 不把密码、密钥打进客户端。
- 知识库文档不进用户数据库；用户对话与报告进用户库，删除账号时可一并清（MVP 不做注销级联 UI，schema 用 `user_id` FK）。

## 8. 错误处理

- LLM / 联网失败：返回启发式回复，metadata 记 `degraded=true`。
- RAG 空结果：仍可对话，提示「本次未命中知识库」。
- 非法阶段（例如未 recommend 就 record）：`409`。
- 客户端超时：toast + 保留输入框内容。

## 9. 测试

后端（必须）：

- 注册登录与鉴权隔离。
- 阶段只允许合法前向迁移。
- 一轮对话会落库消息并可能更新工作区。
- RAG 对种子文档能命中相关框架。
- 记录决策后生成报告且出现在 due reviews。
- 无密钥时 HeuristicCoach 仍能走完全流程。

Flutter：模型解析与阶段条 widget 单测；端到端用后端 TestClient + 浏览器手验 Web。

## 10. 演进预留（不实现）

- `messages.metadata` 可存 token 用量、模型名。
- VectorStore / LLM / WebSearch 均为 Protocol。
- `DATABASE_URL` 切换 Postgres 无需改领域代码。
- 阶段枚举集中在 `domain/stages.py`。
- 聊天接口可加 SSE 而不改工作区模型。
