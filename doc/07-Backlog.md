# DecideFlow Backlog

产品：DecideFlow（决断助手）  
基线：MVP v0.1.0 已交付（见 PRD）  
日期：2026-08-31

状态说明：Done = 已在 MVP；Next = 建议下一迭代；Later = 有价值但非马上；Won't = 当前明确不做。

---

## 已完成（Done）

| ID | 项 | 说明 |
|---|---|---|
| D1 | 邮箱注册登录 + JWT | 用户隔离 |
| D2 | 偏好 Onboarding | 语言/语气/类别/风险/节奏 |
| D3 | 12 个问题模板 + 自定义 | 按偏好排序 |
| D4 | 六阶段对话状态机 | 仅前进 |
| D5 | 启发式教练 | 无密钥可跑通 |
| D6 | LLM 教练端口 | OpenAI JSON，失败降级 |
| D7 | RAG 种子 + 本地向量 | 10 篇原创框架 |
| D8 | Pinecone / OpenAI embedding 端口 | 环境变量切换 |
| D9 | Tavily 联网端口 | collect/evaluate |
| D10 | 原始对话 + workspace + 报告落库 | |
| D11 | 记录决策 + 到期复盘列表 | 默认 14 天 |
| D12 | Flutter 三端工程 | iOS/Android/Web 同一套页面 |
| D13 | 后端/客户端自动化测试 | pytest 13 + flutter test |

---

## 下一迭代建议（Next / P1）

按「用户能立刻感到」优先，而不是先做后台。

| ID | 主题 | 用户故事 | 验收要点 | 估计复杂度 |
|---|---|---|---|---|
| N1 | 流式回复 | 作为用户，希望助手逐字出现，长回复不等一整段 | `POST messages?stream=true` SSE 或 chunk；旧 JSON 仍可用 | 中 |
| N2 | 阶段回退 | 作为用户，评估时发现标准错了，想退回收集 | `POST /decisions/{id}/stage` 只允许回退一格；保留消息 | 中 |
| N3 | 本地到期通知 | 作为手机用户，希望到期当天提醒复盘 | Flutter local_notifications；Web 仅横幅 | 中 |
| N4 | 找回密码 / 改密 | 作为用户，忘记密码仍能回到账号 | 邮件或一次性链接；MVP 现无此能力 | 中 |
| N5 | 报告导出 | 作为用户，想把报告存成文件 | 分享 Markdown/PDF；只导出自己的决策 | 低 |
| N6 | 设置页独立偏好编辑 | 作为用户，改偏好时不想看到「开始使用」文案 | 与 Onboarding 拆成同一表单不同标题 | 低 |
| N7 | 生产配置清单 | 作为部署者，不想误用开发 SECRET 和 CORS=* | README 生产小节 + 启动时弱密钥警告 | 低 |
| N8 | Postgres 默认示例 | 作为部署者，想一条 docker-compose 起来 | compose：api + postgres；SQLite 仍可本地 | 中 |
| N9 | 真实 embedding 回归 | 作为开发者，希望 CI 可选跑 OpenAI 召回质量 | 用录制向量或 skip unless key | 低 |

建议 Next 切片：**N6 + N7 + N5** 先做小体验，再 **N1 或 N3**。

---

## 再往后（Later / P2）

| ID | 主题 | 备注 | 依赖 |
|---|---|---|---|
| L1 | 知识库运营后台 | 上传 MD、触发 ingest、看召回 | 鉴权角色 |
| L2 | 多模型路由 | 按阶段选小模型/大模型 | LLM 端口扩展 |
| L3 | 对话内展示引文 | 把 extra.retrieved 做成可展开卡片 | N1 非必须 |
| L4 | 账号注销与数据删除 | GDPR/个保法向 | 级联删 Message/Decision |
| L5 | OAuth（Apple/Google） | 移动端转化 | 各平台控制台 |
| L6 | 刷新令牌 | 少重新登录 | 现有 JWT 7 天 |
| L7 | 决策对比 | 两次换工作记录并排 | 报告结构稳定 |
| L8 | 团队/配偶只读分享 | 超出个人 MVP | 授权模型 |
| L9 | 分析看板 | onboarding 完成率、走到 recommend 占比 | 事件表 |
| L10 | i18n 界面 | 现仅教练语言跟偏好，UI 中文 | ARB |
| L11 | 阶段手动确认 | 用户点「进入下一阶段」而不是靠轮次 | 与 Heuristic 策略并存 |
| L12 | 选项分数可改 | 用户改某一格分数后重算建议 | workspace.scores |
| L13 | Docker 镜像与健康检查探针 | 便于托管 | L8 无关键路径 |
| L14 | 审计日志 | 管理员看 ingest 与降级次数 | 运维 |

---

## 明确不做（Won't，除非产品方向改变）

| ID | 项 | 原因 |
|---|---|---|
| W1 | 书籍原文入库 | 版权 |
| W2 | 医疗诊断 / 心理治疗 | 资质与安全 |
| W3 | 支付与会员墙 | MVP 验证流程优先 |
| W4 | 社交动态、点赞、公开决策流 | 隐私与范围 |
| W5 | 语音助手 | 非核心闭环 |
| W6 | 客户端直连 OpenAI/Pinecone | 密钥与审计 |

---

## 缺陷与债（已知）

| ID | 问题 | 严重度 | 建议 |
|---|---|---|---|
| B1 | 偏好字段无服务端枚举校验 | 低 | schema 加 Literal |
| B2 | HashEmbedder 召回质量有限 | 中（无密钥时） | 文档标明；生产必须 OpenAI embedding |
| B3 | LlmCoach 为单轮 JSON patch（早期设计曾写 tool calling） | 低 | 需要更强 agent 时再加工具循环 |
| B4 | GET report 与 GET decision 响应相同 | 低 | 可收窄为只返回报告字段 |
| B5 | 无账号注销 | 中（合规） | L4 |
| B6 | `.env.example` 的 SECRET_KEY 仍短于 32 字节 | 低 | 与 config 默认对齐 |
| B7 | 已记录决策在首页与「已复盘」未分子状态文案 | 低 | 列表副标题显示 reviewed |

---

## 优先级原则（后续排期用）

1. 不破坏「无密钥也能跑完全流程」。
2. 不把密钥下发到 Flutter。
3. 新功能优先复用 workspace / Message.extra，避免新表直到必要。
4. 知识库只增原创或授权材料。
