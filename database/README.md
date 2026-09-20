# 云数据库

在微信开发者工具开通云开发后，创建这些集合。

## 权限（面向公众用户必配）

不要再用「所有用户可读，仅创建者可写」这种默认模板应付多家庭场景。推荐：

### xiaoya_users

仅本人可读写自己的文档（`_id` 等于当前用户 openid）：

```
{
  "read": "doc._id == auth.openid",
  "write": "doc._id == auth.openid"
}
```

### 带 `familyId` 的集合：`xiaoya_members` / `xiaoya_babies` / `xiaoya_records`

客户端只读当前家庭；所有写入走云函数（`createFamily`、`joinFamily`、`leaveFamily`、`manageRecord`、`manageFamily`）。

`xiaoya_babies` 可直接粘贴：

```json
{
  "read": "doc.familyId == get(`database.xiaoya_users.${auth.openid}`).currentFamilyId",
  "write": false
}
```

`xiaoya_members`、`xiaoya_records` 用同一条。

### `xiaoya_families`（文档没有 `familyId`）

```json
{
  "read": "doc._id == get(`database.xiaoya_users.${auth.openid}`).currentFamilyId",
  "write": false
}
```

说明：

- `get` 必须用反引号模板：`` get(`database.集合名.${auth.openid}`) ``，**不要**写 `'database.xxx.' + auth.openid`（控制台会报 rule invalid）
- 前端查询必须带上规则里用到的字段，例如宝宝：`where({ familyId: 当前家庭id })`
- 云函数使用服务端 SDK，不受上述客户端规则限制

### 报错 `Cannot read properties of undefined (reading 'currentFamilyId')`

表示 `get(xiaoya_users)` 没找到文档。请检查：

1. 控制台 `xiaoya_users` 是否有文档，且 **`_id` 等于 openid**（不是自动生成的短 id）
2. 该文档是否有非空 **`currentFamilyId`**
3. 已重新上传：`xiaoyaLogin`、`createFamily`、`joinFamily`（旧云函数不会写 users）

临时绕过：先把 babies 规则改成 `"read": true, "write": false`，开通同步成功后再改回收紧规则。
## xiaoya_users（新增）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| nickName | string | 跨家庭展示名（可空） |
| currentFamilyId | string | 当前家庭 _id |
| status | string | active / deleted |
| createdAt | number | |
| lastSeenAt | number | |

文档 `_id` 使用微信 openid。由云函数 `xiaoyaLogin` / `createFamily` / `joinFamily` / `leaveFamily` 维护。

## xiaoya_families

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 家庭名 |
| inviteCode | string | 6 位邀请码，建议建唯一索引 |
| createdAt | number | 时间戳 |
| createdBy | string | 创建者 openid |
| solidFoods | array | 自定义辅食（可选） |

## xiaoya_members

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| familyId | string | 家庭 _id |
| nickName | string | 称呼 |
| role | string | 创建者 / 家长 |
| joinedAt | number | |

`_openid` 由云函数写入。

## xiaoya_babies

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| familyId | string | |
| name | string | |
| birthday | string | YYYY-MM-DD |
| gender | string | girl / boy / unknown |
| avatar | string | |
| createdAt | number | |

## xiaoya_records

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| babyId | string | |
| familyId | string | |
| type | string | milk / breastfeed / sleep / diaper / height / weight / temperature / solid / note |
| subtype | string | formula、pee、left 等 |
| startAt | number | |
| endAt | number \| null | |
| durationMin | number \| null | |
| amount | number \| null | |
| unit | string | |
| note | string | |
| createdBy | string | |
| createdByName | string | |
| createdAt | number | |
| source | string | quick / manual |

建议索引：`xiaoya_records.babyId + startAt`、`xiaoya_families.inviteCode`（唯一）。
