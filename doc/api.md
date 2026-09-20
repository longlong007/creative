# 小芽记接口文档

| 项 | 内容 |
| --- | --- |
| 版本 | 1.0.0 |
| 日期 | 2026-08-31 |
| 风格 | 微信云函数 + 云数据库 + 客户端数据层；无自建 REST |

约定：

- 时间戳均为毫秒。
- 云文档主键 `_id`；小程序侧映射为 `id`。
- 云函数通过 `wx.cloud.callFunction({ name, data })` 调用。
- 失败：云函数 `throw` 会变成客户端 fail；`aiAnalyze` 则用 `{ ok:false }` 业务码，避免云函数运行失败。

---

## 1. 云函数

### 1.1 login

**名称**：`login`  
**用途**：取当前用户 openid，供 `db._loadCloud` 查成员。

**请求**：无

**响应**：

```json
{
  "openid": "oXXXX",
  "appid": "wxXXXX",
  "unionid": ""
}
```

unionid 在未绑定开放平台时可能为空。

---

### 1.2 createFamily

**名称**：`createFamily`  
**用途**：创建家庭、创建者成员、第一个宝宝。

**请求 `data`**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyName | string | 否 | 默认「我家」 |
| inviteCode | string | 否 | 会被 `toUpperCase` |
| baby | object | 否 | |
| baby.name | string | 否 | |
| baby.birthday | string | 否 | YYYY-MM-DD |
| baby.gender | string | 否 | 默认 unknown |

**成功响应**：

```json
{
  "familyId": "云数据库 families._id",
  "inviteCode": "ABC234"
}
```

**错误**：已有 members 记录时 throw `已经在一个家庭里了`。

**副作用**：

- `families.add`：name、inviteCode、createdAt、createdBy=OPENID
- `members.add`：familyId、nickName=`我`、role=`创建者`、joinedAt
- `babies.add`：familyId、name、birthday、gender、avatar=`''`、createdAt

客户端随后调用 `_loadCloud()`，不使用本地预生成的 fam/baby id。

---

### 1.3 joinFamily

**名称**：`joinFamily`

**请求 `data`**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| inviteCode | string | 是 | trim + toUpperCase |

**成功**：

```json
{ "familyId": "...", "already": false }
```

已是该家庭成员：

```json
{ "familyId": "...", "already": true }
```

**错误**：

- 空码：`请输入邀请码`
- 找不到家庭：`邀请码不对`

**副作用**：`members.add`，nickName=`家人`，role=`家长`。

---

### 1.4 aiAnalyze

**名称**：`aiAnalyze`  
**配置**：timeout 60s，memory 256MB，Nodejs 18.15  
**密钥**：`DEEPSEEK_API_KEY` 或本地 `secret.js`（不入库）

**请求 `data`**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| payload | object | 是 | 见 §4 |
| payload.baby | object | 是 | 缺则 BAD_PAYLOAD |
| model | string | 否 | 仅 `deepseek-v4-flash` / `deepseek-v4-pro` |
| thinking | boolean | 否 | 深度思考 |

**成功**：

```json
{
  "ok": true,
  "text": "……五段观察……",
  "model": "deepseek-v4-flash",
  "thinking": false,
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
}
```

`usage` 透传上游，可能为 null。

**失败（仍 HTTP/云函数成功）**：

```json
{
  "ok": false,
  "code": "NO_KEY | BAD_PAYLOAD | UPSTREAM",
  "error": "人类可读原因"
}
```

| code | 含义 |
| --- | --- |
| NO_KEY | 未配置密钥 |
| BAD_PAYLOAD | 缺少 payload.baby |
| UPSTREAM | 超时、HTTP 4xx、空内容、JSON 无法解析 |

上游 URL：`https://api.deepseek.com/chat/completions`  
Header：`Authorization: Bearer <key>`

请求体要点：

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    { "role": "system", "content": "<SYSTEM_PROMPT>" },
    { "role": "user", "content": "<userMessage(payload)>" }
  ],
  "temperature": 0.6,
  "max_tokens": 1800,
  "stream": false,
  "thinking": { "type": "disabled" }
}
```

thinking=true 时：`temperature=0.5`，`max_tokens=3500`，`thinking.type=enabled`，`reasoning_effort=high`，超时 55s（否则 40s）。

---

## 2. 云数据库

集合与字段以 `database/README.md` 为准。下列是小程序实际读写。

建议索引：

- `families.inviteCode`
- `records.babyId + startAt`

### 2.1 客户端查询（`wx.cloud.database`）

| 集合 | 操作 | 条件 | 调用点 |
| --- | --- | --- | --- |
| members | get limit 1 | `_openid = openid` | `_loadCloud` |
| families | doc.get | familyId | `_loadCloud` |
| members | get | familyId | `_loadCloud` |
| babies | get | familyId | `_loadCloud` |
| records | get 分页 | babyId，orderBy startAt desc | `_refreshCloudRecords` |
| babies | add | 当前家庭新宝宝 | `addBaby` |
| babies | update | name/birthday/gender | `updateBaby` |
| records | add | 完整记录（无 id） | `addRecord` |
| records | update | patch | `updateRecord` |
| records | remove | id | `deleteRecord` |

云函数侧还会 `members.count`、`families.where(inviteCode)`、`families.add`、`members.add`、`babies.add`。

### 2.2 records 写入文档形状

```json
{
  "babyId": "...",
  "familyId": "...",
  "type": "milk",
  "subtype": "formula",
  "startAt": 1756652400000,
  "endAt": null,
  "durationMin": null,
  "amount": 120,
  "unit": "ml",
  "note": "",
  "createdBy": "openid 或 local_me",
  "createdByName": "我",
  "createdAt": 1756652400000,
  "updatedAt": 1756652400000,
  "source": "quick"
}
```

`add` 时删除客户端临时 `id`，用返回 `_id`。

---

## 3. 客户端数据层 API（`utils/db.js`）

页面应只通过该模块访问数据，不要直接 `wx.cloud.database`。

| 方法 | 参数 | 返回 | 说明 |
| --- | --- | --- | --- |
| init() | — | this | 启动时调用一次 |
| snapshot() | — | 只读快照 | mode、user、family、members、babies、currentBabyId、baby、records、cloudReady |
| onChange(fn) | fn(snapshot) | unsubscribe | 现页多用 onShow 刷新 |
| hasBaby() | — | boolean | |
| currentBaby() | — | baby \| null | |
| createFamilyAndBaby({ babyName, birthday, gender, familyName }) | object | snapshot | 云则调 createFamily |
| joinFamily(code) | string | snapshot | |
| addBaby({ name, birthday, gender }) | object | baby | 云 add 后用 _id |
| updateBaby(id, patch) | | baby \| null | |
| switchBaby(id) | | void | 云模式会刷新 records |
| addRecord(input) | 见下 | record | |
| updateRecord(id, patch) | | record \| null | |
| deleteRecord(id) | | void | |
| startSleep() | — | record | |
| endSleep() | — | record \| null | |
| getRecord(id) | | record \| null | |
| exportAll() | — | 深拷贝 state | |
| importAll(payload) | version 必须为 1 | void | 无 UI |
| resetLocal() | — | void | 测试用 |
| persist() | — | void | 本地 save + notify |

`addRecord` 入参：

```text
{
  type, subtype?, startAt?, endAt?, durationMin?, amount?, unit?, note?, source?
}
```

缺省：`startAt=now`，`source='quick'`，`createdBy` 取当前 user。

异常：

- 无宝宝 `addRecord`：`还没有宝宝`
- 空邀请码：`请输入邀请码`
- 本地加入失败：`本地模式无法跨设备加入。请在 config.js 填写云开发环境 ID，或让家人在同一部手机上记录。`
- 导入：`备份格式不对`

---

## 4. AI Payload（小程序 → 云函数 / 直连）

由 `insights.buildAiPayload` 生成。

```json
{
  "baby": {
    "name": "小芽",
    "gender": "女",
    "birthday": "2026-01-01",
    "age": "7个月30天"
  },
  "from": 0,
  "to": 0,
  "fromText": "2026-08-25",
  "toText": "2026-08-31",
  "rangeLabel": "近7天",
  "summary": {
    "milkMl": 120,
    "milkCount": 1,
    "breastMin": 0,
    "sleepMin": 0,
    "diaperCount": 0,
    "recordCount": 1
  },
  "records": [
    {
      "type": "milk",
      "subtype": "formula",
      "startAt": 0,
      "endAt": null,
      "amount": 120,
      "unit": "ml",
      "durationMin": null,
      "note": "",
      "time": "2026-08-31 14:00"
    }
  ]
}
```

gender 已是中文：女 / 男 / 未填。

`utils/ai.analyze({ payload, model, thinking })`：

- `payload.summary.recordCount < 1` 直接抛「这一段还没什么记录，先记几条再分析」
- 云函数 `NO_KEY` 且 `config.deepseekApiKey` 非空：改走 `wx.request`
- 云函数其它失败且有调试 Key：同样兜底直连
- 都没有：抛出 `setupHint()` 长文案

直连 URL：`config.deepseekBaseUrl`，默认 `https://api.deepseek.com/chat/completions`。

---

## 5. 页面路由

| 路径 | 参数 | 说明 |
| --- | --- | --- |
| /pages/index/index | — | Tab 记录 |
| /pages/timeline/timeline | — | Tab 时间轴 |
| /pages/growth/growth | — | Tab 生长 |
| /pages/family/family | — | Tab 家庭 |
| /pages/onboarding/onboarding | — | 引导 |
| /pages/join/join | — | 邀请码 |
| /pages/insights/insights | — | 洞察（非 Tab） |
| /pages/record-edit/record-edit | id 或 type=sleep | 编辑 / 补记睡眠 |
| /pages/baby-edit/baby-edit | id? | 无 id 为新增 |

事件：`record-item` 触发 `edit`，detail `{ id }`。

---

## 6. 本地存储 Key

| Key | 内容 |
| --- | --- |
| xiaoya_db_v1 | 本地整库（local 模式） |
| xiaoya_current_baby | 当前宝宝 id（云模式也用） |
| xiaoya_ai_cache_v1 | `{ key, text, meta, at }` |

---

## 7. 配置项 `miniprogram/config.js`

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| appName | 小芽记 | |
| cloudEnv | `''` | 空则纯本地 |
| inviteCodeLength | 6 | |
| deepseekApiKey | `''` | 仅本机调试，禁止提交真实值 |
| deepseekModel | deepseek-v4-flash | |
| deepseekBaseUrl | DeepSeek chat completions | |

---

## 8. 上游 DeepSeek（参考）

非正式封装的第三方 API。鉴权 Bearer Token。响应取 `choices[0].message.content`（string 或 text parts 数组拼接）。

错误信息优先 `error.message`。超时文案：「分析超时，请稍后再试」。

小程序正式版若只走云函数，**不必**把 `api.deepseek.com` 配进 request 合法域名；仅前端调试直连时需要。
