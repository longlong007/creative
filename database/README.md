# 云数据库

在微信开发者工具开通云开发后，创建这些集合。权限建议先用「所有用户可读，仅创建者可写」再按需放宽；家庭共享记录由云函数校验成员关系。

## xiaoya_families

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 家庭名 |
| inviteCode | string | 6 位邀请码，建议建索引 |
| createdAt | number | 时间戳 |
| createdBy | string | 创建者 openid |

## xiaoya_members

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| familyId | string | 家庭 _id |
| nickName | string | 称呼 |
| role | string | 创建者 / 家长 |
| joinedAt | number | |

`_openid` 由云开发自动写入。

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

结构化记录，方便以后做 AI 洞察。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| babyId | string | |
| familyId | string | |
| type | string | milk / breastfeed / sleep / diaper / height / weight / temperature / solid / note |
| subtype | string | formula、pee、left 等 |
| startAt | number | |
| endAt | number \| null | 睡眠结束 |
| durationMin | number \| null | |
| amount | number \| null | ml / cm / kg / °C |
| unit | string | |
| note | string | |
| createdBy | string | |
| createdByName | string | |
| createdAt | number | |
| source | string | quick / manual |

建议为 `xiaoya_records.babyId + startAt`、`xiaoya_families.inviteCode` 建索引。
