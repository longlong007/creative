# 小芽记

家庭共用的宝宝成长记录微信小程序。先把「记下」这件事做到一两下就能完成，数据和结构按以后做 AI 洞察来设计。

## 能记什么

- 喝奶：配方奶 / 母乳瓶喂 / 亲喂，常用毫升一键选
- 睡眠：点一下开始，再点一下醒来；也能补记
- 尿布：嘘嘘、便便各一键
- 身高、体重、体温、辅食、备注
- 时间轴按天汇总，生长页有身高体重曲线
- 家庭邀请码；开通云开发后，家里几部手机共用一本账
- 本周观察，以及用 DeepSeek 直接分析奶量、睡眠和生长趋势

## 为什么记起来快

首页四个大按钮：喝奶、睡觉/醒来、嘘嘘、便便。

- 睡觉、尿布：点一下就写入
- 喝奶：弹出上次用量，改或不改，再点一次保存
- 可把时间快速改成 5 / 15 / 30 分钟前，不用翻日期控件

## 本地怎么打开

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本仓库目录，AppID 可先用测试号
3. 编译后从「给宝宝建一本」开始即可在本机记录

本机数据存在微信缓存里，适合先用。家庭多设备同步需要云开发。

## 开通家庭同步（云开发）

1. 在开发者工具开通云开发，记下环境 ID
2. 把 ID 填进 `miniprogram/config.js` 的 `cloudEnv`
3. 云开发控制台创建集合：`families`、`members`、`babies`、`records`（字段说明见 `database/README.md`）
4. 上传并部署云函数：`login`、`createFamily`、`joinFamily`、`aiAnalyze`
5. `families.inviteCode` 建议建索引

之后把家庭页里的邀请码发给家人即可加入。

## DeepSeek 数据分析

洞察页可以把一段记录发给 DeepSeek，生成奶量、睡眠、尿布、生长和漏记观察。默认模型是 `deepseek-v4-flash`，打开「深度思考」会启用思考模式（更慢、更细）。

密钥不要写进小程序代码。推荐做法：

1. 在 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建 API Key
2. 开通云开发，部署云函数 `aiAnalyze`（超时建议 60 秒）
3. 给该云函数配置环境变量 `DEEPSEEK_API_KEY`
4. 把环境 ID 填进 `miniprogram/config.js` 的 `cloudEnv`
5. 开发者工具里把 `api.deepseek.com` 配进 request 合法域名；开发阶段可先关掉 URL 校验

本机调试可复制 `cloudfunctions/aiAnalyze/secret.example.js` 为 `secret.js`，或临时把 key 填进 `config.js` 的 `deepseekApiKey`。这两种方式都不要提交到 Git。

没有密钥时，仍可「复制分析提示词」贴到 DeepSeek 网页。分析结果不是医疗诊断。

```bash
npm test
```

跑的是记录、汇总、月龄和洞察提示词的逻辑测试，不依赖微信开发者工具。
