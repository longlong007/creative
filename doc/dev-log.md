# 小芽记开发记录

| 项 | 内容 |
| --- | --- |
| 仓库 | xiaoya-ji |
| 当前版本 | 1.0.0 |
| 整理日期 | 2026-08-31 |
| 基线提交 | `acdd6c8` Initial commit → `d4d0ce7` 小程序主体 → `bde6aaa` DeepSeek |

本文记录「已经做了什么、为什么这么做、测了什么、还欠什么」，不是changelog 自动生成器。提交信息以 git log 为准。

---

## 1. 迭代时间线

| 提交 | 日期 | 内容 |
| --- | --- | --- |
| acdd6c8 | 2026-08-31 | 空仓库初始提交 |
| d4d0ce7 | 2026-08-31 | 家庭宝宝成长记录小程序：页面、本地/云双存储、时间轴、生长、家庭、本周洞察、逻辑测试 |
| bde6aaa | 2026-08-31 | 接入 DeepSeek：云函数 `aiAnalyze`、洞察页一键分析、深度思考、提示词同步测试 |

产品从第一天就按「快记 + 结构化记录 + 可分析」三条线铺，而不是先做日记再重构。

## 2. 关键设计决策

### 2.1 先本地后云，同一套 `db` 门面

`utils/db.js` 对页面暴露相同方法。`cloudEnv` 为空时不调用云，降低体验门槛（测试号也能记）。

代价：本地 JSON 与云文档两套 id；开通云后不会自动把 storage 里的历史迁上去。导出 JSON 是目前唯一备份口，导入只有 API 没有页面。

### 2.2 记录用 type/subtype 而不是自由文本

为后续聚合和 AI 准备。标题文案集中在 `stats.recordTitle`，避免页面里到处拼字符串。

亲喂没有单独做「计时开始/结束」，而是和瓶喂共用喝奶面板、用分钟快选。睡眠才用进行中状态，因为跨时长更长、更需要横幅。

### 2.3 睡眠跨夜用 overlap，列表分组用 startAt

统计「今天睡了多久」按与自然日的交集；时间轴把整条挂在入睡日。实现简单，和用户直觉基本一致（「昨晚 23 点睡的」出现在昨天）。

### 2.4 云函数只覆盖身份与 AI，记录仍客户端直写

`login` / `createFamily` / `joinFamily` 必须在服务端拿 OPENID。日常 `records.add` 走客户端，省云函数调用、快记延迟低。

安全上弱于「全部云函数鉴权」。集合权限很难同时满足「家人共写」和「外人不可见」。这是明确的技术债，见 Backlog P1。

### 2.5 AI 双通道

生产：云函数持有 Key。  
开发：`config.deepseekApiKey` 或云函数 `secret.js`。  
无 Key：复制 `buildAiPrompt` 文本。

小程序与云函数各有一份 `prompt.js`，用测试锁一致性，避免只改一端。

### 2.6 不做诊断

系统提示词禁止诊病、用药、停奶、恐吓。洞察规则里的「睡眠偏短」也写成漏记可能性。产品文案同步免责。

### 2.7 邀请码去易混字符

`I/O/0/1` 去掉，降低口头传达错误。未做云端唯一性碰撞重试（6 位空间对家庭数量足够，仍非零风险）。

### 2.8 自定义 Tab + 洞察二级页

高频四件事进 Tab；洞察不是每天必开，放导航按钮，减少 Tab 拥挤。

### 2.9 测试不依赖开发者工具

`tests/run.js` require 小程序 utils。`db` 在无 `wx` 时用内存。这样云环境和 CI 都能 `npm test`。

## 3. 目录与职责（实现时的约定）

```
miniprogram/pages/*     只做交互和 setData
miniprogram/utils/*     纯逻辑 + db
cloudfunctions/*        微信身份、外部 HTTP
tests/run.js            断言 utils 行为
database/README.md      给控制台建表的人看
```

页面里出现业务规则（例如喝奶默认量）时，优先能抽到 present/stats 的抽走；首页 sheet 仍有一部分 UI 状态留在 Page.data。

## 4. 测试记录

命令：`npm test`（`node tests/run.js`）

已覆盖用例（名称即测试名）：

- ageText: months and days / one year / days only
- formatDurationMin、formatAgo
- sleep overlap across midnight
- invite code charset and length
- today milk and diaper stats
- active sleep and title、record titles
- db local family and quick records
- insights prompt is AI-ready
- join family rejects empty code
- resolveRange 7d and 30d
- buildAiPayload compact records
- formatAiText strips markdown
- ai prompt helpers stay in sync

未覆盖：WXML 事件、Canvas、真实云函数、DeepSeek 网络、云权限、分页边界（第 201 条记录）。

## 5. 配置与密钥纪律

- `cloudEnv`、`deepseekApiKey` 默认空字符串，避免误提交。
- `.gitignore`：`cloudfunctions/**/secret.js`。
- 示例文件 `secret.example.js` 只有占位 `sk-replace-me`。
- README 写明：开发者工具可关 URL 校验；正式环境必须配环境变量。

## 6. 已知限制（开发时已意识到）

1. 云记录最多拉 200 条。
2. `createFamily` 无事务，中途失败可能脏数据。
3. `joinFamily` 不阻止一个 openid 加入第二家，与「创建只能一家」不对称。
4. 成员昵称写死「我 / 家人」。
5. 记录编辑不能改 type/subtype（例如嘘嘘改成 both）。
6. 首页没有尿布「都有」快钮（常量里有 `DIAPER_SUBTYPES.both`）。
7. `importAll` / `resetLocal` 无界面。
8. 生长曲线无参考百分位。
9. 客户端写云库，安全模型未完成。
10. AI 结果仅本地缓存，换设备看不到上次分析。

## 7. 体验上已做的小处理

- 快记成功 `wx.vibrateShort`
- 睡眠进行中首页 1 秒刷新时长
- 喝奶默认上次瓶喂量
- 时间偏移避免打开原生日期时间选择器（快记场景）
- 分析中 mask loading；深度思考文案改为「深度分析中」
- 分析结果去掉模型爱用的 Markdown 标题，适合小程序纯文本块

## 8. 发布检查单（开发自用）

- [ ] AppID 不是 touristappid（若要真机给家人）
- [ ] `deepseekApiKey` 为空再上传
- [ ] `secret.js` 未进入云函数以外的目录、未被 git 跟踪
- [ ] 四集合已建、inviteCode 索引已建
- [ ] 四个云函数已部署，aiAnalyze 超时 ≥ 60s
- [ ] `npm test` 绿
- [ ] 用两个微信号走一遍加入家庭
- [ ] 洞察页免责文案仍在

## 9. 文档同步

本次（文档迭代）在 `doc/` 补齐 PRD、架构、详细设计、接口、用户说明、本开发记录与 Backlog。代码行为以仓库为准，文档与 `d4d0ce7`+`bde6aaa` 对齐。之后改接口或记录类型时，至少更新 `doc/api.md` 与 `database/README.md`。
