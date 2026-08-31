# 小芽记系统详细设计

| 项 | 内容 |
| --- | --- |
| 版本 | 1.0.0 |
| 日期 | 2026-08-31 |
| 对应代码 | `miniprogram/`、`cloudfunctions/`、`tests/` |

---

## 1. 模块一览

| 模块 | 文件 | 职责 |
| --- | --- | --- |
| 应用入口 | `app.js` | `db.init()`，`whenReady()` 队列 |
| 配置 | `config.js` | `appName`、`cloudEnv`、邀请码长度、DeepSeek 调试项 |
| 数据门面 | `utils/db.js` | 本地/云双写、家庭、宝宝、记录 CRUD、睡眠起止 |
| 展示组装 | `utils/present.js` | 首页卡片数据、时间轴按天分组 |
| 统计 | `utils/stats.js` | 区间聚合、进行中睡眠、生长序列、记录标题 |
| 格式 | `utils/format.js` | 日界、月龄、时长、相对时间、睡眠重叠分钟 |
| 洞察 | `utils/insights.js` | 本周报告、AI payload、提示词、结果去 Markdown |
| AI 调用 | `utils/ai.js` | 云函数优先，调试 Key 兜底 |
| 提示词 | `utils/ai-prompt.js` | 与云函数 `prompt.js` 同步 |
| 常量 | `utils/constants.js` | 类型颜色、奶量子类型、常用量、更多入口 |
| ID | `utils/id.js` | `uid(prefix)`、邀请码 |

## 2. 启动与就绪

```javascript
App.onLaunch
  → db.init()
  → globalData.ready = true
  → 唤醒 whenReady 等待者

Page.onShow
  → await getApp().whenReady()
  → 无宝宝则 redirectTo onboarding
```

`db.init()` 顺序：

1. 若 `config.cloudEnv` 且存在 `wx.cloud`：`wx.cloud.init`，`login` 取 openid，查 `members`。
2. 有成员则拉 family / members / babies，再拉当前宝宝 records，`mode='cloud'`。
3. 否则 `_loadLocal()`，`mode='local'`。
4. 云初始化异常：warn 后本地。

## 3. 数据模型

本地状态（`emptyState`，storage 版本 `version: 1`）：

```text
{
  version, user, family, members[], babies[], currentBabyId, records[]
}
```

云文档用 `_id`；客户端统一映射为 `id`（`_fromCloud`）。

### 3.1 family

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id / _id | string | |
| name | string | 默认「{宝宝名}的家」或「我家」 |
| inviteCode | string | 6 位 |
| createdAt | number | ms |
| createdBy | string | 本地 user.id 或 openid |

### 3.2 member

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| familyId | string | |
| nickName | string | 创建者「我」，加入者「家人」 |
| role | string | 创建者 / 家长 |
| joinedAt | number | |
| _openid | string | 仅云，自动写入 |

当前未做微信资料授权，昵称不会更新成真实微信名。

### 3.3 baby

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| familyId | string | |
| name | string | |
| birthday | string | YYYY-MM-DD |
| gender | string | girl / boy / unknown |
| avatar | string | 预留，现为空 |
| createdAt | number | |
| updatedAt | number | 编辑时 |

### 3.4 record

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| babyId, familyId | string | |
| type | string | 见 PRD |
| subtype | string | 可空 |
| startAt | number | 业务时间 |
| endAt | number \| null | 睡眠结束 |
| durationMin | number \| null | 睡眠由起止计算；亲喂可由 amount 回填 |
| amount | number \| null | |
| unit | string | ml / 分钟 / cm / kg / °C |
| note | string | |
| createdBy, createdByName | string | |
| createdAt, updatedAt | number | |
| source | string | quick / manual |

## 4. 页面详细设计

### 4.1 引导 `pages/onboarding`

- `step: hello | create`。
- hello：建一本 / 我有邀请码。
- create：名字必填、性别默认 girl、生日默认约 90 天前。
- 已有宝宝则 `switchTab` 首页。
- `submit` → `db.createFamilyAndBaby`。

### 4.2 加入 `pages/join`

- 输入转大写；空码 Toast。
- `db.joinFamily`；失败 `showModal`。
- 成功 `switchTab` 首页。

### 4.3 记录首页 `pages/index`

数据来自 `present.presentHome(snapshot)`：

- 今日奶量 ml、睡眠时长、尿布次数
- 上次喝奶标题与相对时间
- 进行中睡眠及已睡时长（1s tick）
- 最近 8 条 `record-item`

交互：

| 控件 | 行为 |
| --- | --- |
| 喝奶 | sheet=milk，默认上次量 |
| 睡觉/醒来 | `startSleep` / `endSleep` |
| 嘘嘘/便便 | `addRecord(diaper)` |
| 更多 | sheet=more → form；睡眠跳转 record-edit?type=sleep |
| 洞察 | navigateTo insights |
| 宝宝头 | switchTab 家庭 |

喝奶保存：`breastfeed` 类型把分钟写入 `durationMin` 与 `amount`。

时间：`TIME_OFFSETS` 把 `Date.now()` 加上分钟偏移作为 `startAt`。

### 4.4 时间轴 `pages/timeline`

过滤：

- all
- milk = milk ∪ breastfeed
- sleep
- diaper
- growth = height ∪ weight

`presentTimeline` 按 `startOfDay(startAt)` 分组，组内再 `aggregate` 生成「奶 xml · 睡 x · 尿布 x」。跨夜睡眠只出现在 `startAt` 所在日（分组键是 startAt，不是 overlap）。**注意**：日汇总的睡眠分钟用 overlap，但记录挂在开始那一天。

### 4.5 生长 `pages/growth`

- Tab：weight / height
- 最新值 + Canvas 2d 折线
- 单点时 min/max ±1 避免除零
- 0 点：文案「量两次就能看到曲线」
- 添加走 sheet，`source: manual`

### 4.6 家庭 `pages/family`

- 编辑当前宝宝、切换宝宝、添加宝宝
- 复制邀请码
- `cloudReady \|\| config.cloudEnv` 决定是否显示「可跨设备」文案
- 导出 `JSON.stringify(db.exportAll())` 到剪贴板
- 无导入 UI（`db.importAll` 已实现）

### 4.7 宝宝编辑 `pages/baby-edit`

- 无 query.id：新增 `addBaby`
- 有 id：`updateBaby` 补丁 name/birthday/gender

### 4.8 记录编辑 `pages/record-edit`

- `?id=` 编辑已有：改 startAt、amount、note；可删除
- `?type=sleep` 无 id：补记，校验 endAt > startAt
- 睡眠 duration 在 `updateRecord`/`addRecord` 内重算

### 4.9 洞察 `pages/insights`

- 上半：`buildReport` 本周（周一至今天）指标、段落、亮点、建议
- 下半：DeepSeek，range = week | 7d | 30d，thinking 开关
- 缓存 key：`babyId:range:think|fast`，storage `xiaoya_ai_cache_v1`
- 无记录：不请求，展示「先记几条」
- `formatAiText` 去掉 `#` 标题、`**`、把列表改成 `· `

### 4.10 自定义 Tab

`custom-tab-bar` 四项，各页 `onShow` 调 `getTabBar().setData({ selected })`。

### 4.11 组件 `record-item`

观察 `record`，用 `stats.recordTitle/TimeLabel/typeMeta`。点击 `triggerEvent('edit', { id })`。进行中睡眠 `open=true`。

## 5. 数据层算法

### 5.1 本地持久化

- Key：`xiaoya_db_v1`
- 写入对象（非字符串）；读取兼容 string JSON
- Node 测试无 `wx` 时用内存 `_mem`

### 5.2 云记录分页

```
PAGE=20, 最多 10 轮
where babyId = 当前宝宝
orderBy startAt desc
```

切换宝宝会 `_refreshCloudRecords`。

### 5.3 睡眠

- `startSleep`：已有 `type=sleep && !endAt` 则返回该条，不新建。
- `endSleep`：给该条写 `endAt=now`。
- duration：`max(1, round((endAt-startAt)/60000))`。进行中 overlap 用 `Date.now()` 作 end。

### 5.4 邀请码

字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`，默认长度 `config.inviteCodeLength`（6）。云端加入时 `toUpperCase()`。

本地 `joinFamily`：只有输入码等于本机 family.inviteCode 才算成功，否则抛「本地模式无法跨设备加入」。

### 5.5 建家冲突

云函数：该 openid 在 `members` 已有记录则抛「已经在一个家庭里了」。不校验邀请码全局唯一。

## 6. 统计设计

`stats.aggregate(records, from, to, now)`：

- **睡眠**：`overlapMinutes(start, end, from, to)`，即使 startAt 在区间外，只要与区间相交也计入。
- **其他类型**：`startAt` 落在 `[from, to]`。
- 瓶喂：`type==='milk'` 累加 ml 与次数。
- 亲喂：`durationMin \|\| amount`。
- 尿布 both：pee 与 poop 各 +1，次数 +1。

`todayStats`：当天 00:00:00.000 至 23:59:59.999。

`latestGrowth`：按数组顺序取第一条 height/weight。记录通常新在前，因此是「最新」。`growthSeries` 会再按时间升序。

`averageIntervalMin`：区间内同 type 相邻 `startAt` 平均间隔。

## 7. 本周洞察规则

- 周起始：周一 00:00（周日算上一周的第 7 天）。
- 日均：对「已度过的天」（`date <= now`）求平均奶量/睡眠/尿布。
- 亮点：日均奶量、日均睡眠、最长觉 ≥180 分钟、瓶喂间隔、日均尿布。
- 警示：
  - 今天之前有 ≥2 天完全无奶也无亲喂 → 可能漏记
  - ≥3 天睡眠 <480 分钟且日均 <600 分钟 → 偏短或漏记
- 建议：无身高体重则催补一条；否则建议同时间段定期量。

这些规则是启发式，不是医学标准。

## 8. AI Payload 设计

`buildAiPayload(baby, records, rangeKey, now)`：

```text
baby: { name, gender 中文, birthday, age }
from/to 时间戳 + fromText/toText + rangeLabel
summary: milkMl, milkCount, breastMin, sleepMin, diaperCount, recordCount
records[]: type, subtype, startAt, endAt, amount, unit, durationMin, note, time
```

range：

| key | from | 文案 |
| --- | --- | --- |
| week | 本周一 | 本周 |
| 7d | 今天往前 6 天 0 点 | 近7天 |
| 30d | 今天往前 29 天 0 点 | 近30天 |
| to | 均为当天 endOfDay | |

`recordCount` 对睡眠用 overlap>0 计数，与明细 compact 的过滤略有不同（compact 含 start 在区间外但 end 落入的睡眠）。

请求体：

- temperature：深度 0.5 / 普通 0.6
- thinking.enabled / disabled
- 深度另加 `reasoning_effort: high`

模型：非法名一律 `deepseek-v4-flash`。

## 9. 云函数内部设计

### login

无入参，返回微信上下文三件套。

### createFamily

入参：`familyName`、`inviteCode`、`baby{name,birthday,gender}`。

步骤：count members by OPENID → add family → add member 创建者 → add baby。baby 的云 `_id` 由云生成，忽略客户端预生成 id。

失败不回滚（无事务）。若 family 已写入、后一步失败，可能留下无宝宝家庭。Backlog：事务或补偿。

### joinFamily

按 `inviteCode` 查 families；已在该家则 `{ already:true }`；否则 add member 角色家长。

不检查「是否已在别的家庭」。与 createFamily 的「一人一家」不完全对称：已在 A 家的用户仍可能加入 B 家，产生多条 members。Backlog：加入前也应按 OPENID 查重。

### aiAnalyze

- 无 Key → `{ ok:false, code:'NO_KEY' }`
- 无 payload.baby → `BAD_PAYLOAD`
- HTTPS 自封装，不用云调用外部网络的额外 SDK
- 上游 4xx 或空文本 → `UPSTREAM`

## 10. 错误与空态

| 场景 | 表现 |
| --- | --- |
| 无宝宝 | 重定向引导 |
| 今日无记录 | 首页三项为 — |
| 时间轴无数据 | 「这一类还没有记录」 |
| 生长无点 | 「还没量」+ 画布提示 |
| 删记录确认 | Modal「删了就不能恢复」 |
| 分析无记录 | 页内错误文案，不请求网络 |
| 未配置 AI | Modal 配置说明；仍可复制提示词 |

## 11. 样式与设计 token（实现约定）

来自 `app.json` / 类型色：

- 导航底、页面底 `#F7F1EA`
- Tab 未选 `#8A8178`，选中 `#E07A5F`
- 各记录类型有独立 color/bg（`RECORD_TYPES`）

不做独立设计系统文档；改色以 `constants.js` 与 `app.wxss` 为准。

## 12. 扩展点

| 扩展 | 接入方式 |
| --- | --- |
| 新记录类型 | `RECORD_TYPES` + 首页 MORE_ACTIONS + stats.recordTitle + 时间轴 filter |
| 新云集合 | `db._loadCloud` 增加拉取；权限单独配 |
| 换模型供应商 | 改 `aiAnalyze` 与 `config.deepseekBaseUrl`；保持 payload 不变 |
| 标准生长曲线 | `growth` 画布叠加参考线，数据放静态 JSON |
