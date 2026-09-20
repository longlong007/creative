# 微信登录审核整改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户未登录也能浏览并体验「记录」等核心页；任何建账/加入/云同步都可取消，且取消后不会被反复送回欢迎页。

**Architecture:** 本小程序属于[登录规范](https://developers.weixin.qq.com/community/develop/doc/0000ccf58c05402478534e85f61809)里的「体验范围开放」：先开放页面体验，身份相关操作由用户主动点，且必须有有效的取消/返回。启动不再 `redirectTo` 欢迎页；建账默认写本地；`xiaoyaLogin` / `createFamily` / `joinFamily` 只在用户点「开通同步」或「加入家庭」后发生。

**Tech Stack:** 微信小程序、云开发（可选）、本地 `wx.setStorageSync`、`tests/run.js`

## Global Constraints

- 对照规范：先体验、后授权；登录/加入环节必须有显著「暂不登录 / 返回 / 取消」；点击后真正退出该流程，不得无响应、不得立刻再跳回。
- 本产品没有手机号/`getUserProfile`。审核把欢迎页两个按钮（云环境下会调云函数）当成登录环节。
- 文案避免「必须登录才能用」。取消按钮用「暂不登录，先看看」「返回」「取消」，不要用「跳过」这种弱文案。
- 不要改 DeepSeek、生长曲线算法、记录数据结构。
- 不跑 `rm`；不提交 git，除非用户明确要求。

## 规范对照（当前为什么会被拒）

官方要求（开放范围）：

1. 进入小程序应能浏览功能页，不得一进就要求登录。
2. 用户主动进入登录/加入后，必须能取消/拒绝/返回。
3. 取消必须有效：不能没反应，也不能马上再强制进入同一流程。

当前实现：

- `app.json` 首页是 Tab「记录」`pages/index/index`。
- `index.js` / `timeline.js` / `growth.js` / `family.js`：没宝宝就 `wx.redirectTo` 欢迎页（栈被替换，没有返回）。
- 欢迎页只有「给宝宝建一本」「我有邀请码」。`cloudEnv` 已配置时，前者调 `createFamily`，后者调 `joinFamily`；`db.init` 还会调 `xiaoyaLogin`。
- 填宝宝资料一步没有返回欢迎页。
- `join.js` 失败弹窗 `showCancel: false`。

审核路径：打开「记录」→ 被赶到欢迎页 → 只能建账或加入 → 判定强制登录。

## 目标交互

```
打开小程序
  → 停在「记录」Tab（空状态，四个功能入口仍可见）
  → 可切时间轴 / 生长 / 家庭（同样空状态，不跳欢迎页）
  → 点「给宝宝建一本」：navigateTo 欢迎页（可返回）
       → 「暂不登录，先看看」：回到记录空状态
       → 填资料「开始记录」：只建本地账，switchTab 记录
  → 点「我有邀请码」：加入页有「暂不加入」
  → 家庭页「开通家庭同步」：弹窗「取消 / 开通」，开通才 xiaoyaLogin + createFamily
```

---

### Task 1: 去掉 Tab 强制跳转，空状态可浏览

**Files:**
- Modify: `miniprogram/pages/index/index.js`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/pages/timeline/timeline.js`
- Modify: `miniprogram/pages/timeline/timeline.wxml`
- Modify: `miniprogram/pages/growth/growth.js`
- Modify: `miniprogram/pages/growth/growth.wxml`
- Modify: `miniprogram/pages/family/family.js`
- Modify: `miniprogram/pages/family/family.wxml`
- Modify: `miniprogram/pages/family/family.wxss`（若空状态需要）

**Interfaces:**
- Consumes: `db.hasBaby()`, `db.snapshot()`, 现有 `showTabBar`
- Produces: 各 Tab 在 `!baby` 时渲染空状态；`goOnboarding()` / `goJoin()` 用 `navigateTo`，禁止 `redirectTo` onboarding

- [ ] **Step 1: 记录页去掉 redirect，未建账仍渲染页面**

`index.js` 的 `onShow` 改成：没有宝宝也 `refresh()`，不要 `redirectTo`。

```javascript
async onShow() {
  showTabBar(this, 0)
  await getApp().whenReady()
  if (db.hasBaby()) {
    this.bindDb()
    await db.syncRecords()
    this.startTick()
  } else {
    this.unbindDb()
    this.stopTick()
  }
  this.refresh()
},

goOnboarding() {
  wx.navigateTo({ url: '/pages/onboarding/onboarding' })
},

goJoin() {
  wx.navigateTo({ url: '/pages/join/join' })
},
```

`openMilk` / `toggleSleep` / `saveDiaper` / `openSolid` / `openMore` 开头加：

```javascript
if (!db.hasBaby()) {
  wx.showModal({
    title: '先给宝宝建一本',
    content: '建好后就可以记喝奶、睡眠和尿布。也可以先看看页面。',
    confirmText: '去填写',
    cancelText: '暂不登录',
    success: (res) => {
      if (res.confirm) wx.navigateTo({ url: '/pages/onboarding/onboarding' })
    }
  })
  return
}
```

`index.wxml` 用 `wx:if="{{baby}}"` 保留现有内容；`wx:else` 空状态仍展示四个大按钮（审核要看到功能页），按钮走上面的 modal。空状态顶部加：

```xml
<view class="page safe-bottom" wx:else>
  <view class="guest-hero">
    <view class="title">小芽记</view>
    <view class="sub">先看看怎么记。建账或加入家庭都可以随时取消。</view>
    <button class="btn btn-primary" bindtap="goOnboarding">给宝宝建一本</button>
    <button class="btn btn-ghost" bindtap="goJoin">我有邀请码</button>
  </view>
  <!-- 复用现有 grid 四个按钮，bindtap 仍走 openMilk 等，内部拦截 -->
</view>
```

四个按钮可从现有 `grid` 复制一份到 `wx:else`，避免改动已登录布局。样式跟现有 `.q` 走，`.guest-hero` 参考 onboarding 的 title/sub。

- [ ] **Step 2: 时间轴、生长去掉 redirect**

`timeline.js` / `growth.js`：删掉 `if (!db.hasBaby()) { wx.redirectTo(...) }`。没有宝宝时 `refresh` 得到空列表即可。

时间轴已有「这一类还没有记录」。补一行引导：

```xml
<view wx:if="{{!groups.length}}" class="empty">
  <view>还没有记录，可先浏览页面</view>
  <view class="link" bindtap="goOnboarding">给宝宝建一本</view>
</view>
```

生长页「还没有测量」同样加 `goOnboarding`，不要整页跳走。

- [ ] **Step 3: 家庭页空状态**

`family.js` 去掉 redirect。`family.wxml` 现有根节点是 `wx:if="{{baby}}"`，补 `wx:else`：

```xml
<view class="page safe-bottom" wx:else>
  <view class="title">家庭</view>
  <view class="muted">可以先看看。建账和加入都可以取消，不强制登录。</view>
  <button class="btn btn-primary" bindtap="goOnboarding">给宝宝建一本</button>
  <button class="btn btn-ghost" bindtap="goJoin">我有邀请码</button>
</view>
```

`goOnboarding` 用 `navigateTo`。

- [ ] **Step 4: 开发者工具手测**

清缓存后编译：落地是「记录」而不是欢迎页；四个 Tab 都能进；点「暂不登录」留在记录页，再切 Tab 不会被拉回欢迎页。

---

### Task 2: 欢迎页 / 加入页提供有效取消和返回

**Files:**
- Modify: `miniprogram/pages/onboarding/onboarding.wxml`
- Modify: `miniprogram/pages/onboarding/onboarding.js`
- Modify: `miniprogram/pages/onboarding/onboarding.wxss`
- Modify: `miniprogram/pages/join/join.wxml`
- Modify: `miniprogram/pages/join/join.js`

**Interfaces:**
- Consumes: Task 1 的 `navigateTo`；`db.createFamilyAndBaby`（Task 3 改为默认本地）
- Produces: `skipLogin()`、`backHello()`、`skipJoin()`；加入失败弹窗可取消

- [ ] **Step 1: 欢迎页 hello 增加显著「暂不登录，先看看」**

`onboarding.wxml` `step === 'hello'` 在两个主按钮下方加 ghost 按钮，字号不要比主按钮更小到看不清：

```xml
<button class="btn btn-primary" bindtap="goCreate">给宝宝建一本</button>
<button class="btn btn-ghost" bindtap="goJoin">我有邀请码</button>
<button class="btn btn-ghost skip" bindtap="skipLogin">暂不登录，先看看</button>
```

```javascript
skipLogin() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack()
    return
  }
  wx.switchTab({ url: '/pages/index/index' })
},
```

- [ ] **Step 2: 填资料一步加返回**

`step !== 'hello'` 顶部加：

```xml
<view class="back" bindtap="backHello">返回</view>
```

```javascript
backHello() {
  this.setData({ step: 'hello' })
},
```

- [ ] **Step 3: 加入页「暂不加入」+ 失败可取消**

`join.wxml`：

```xml
<button class="btn btn-primary" bindtap="submit">加入</button>
<button class="btn btn-ghost" bindtap="skipJoin">暂不加入</button>
```

`skipJoin` 与 `skipLogin` 相同（navigateBack 或 switchTab 记录）。

`join.js` 失败弹窗改为：

```javascript
wx.showModal({
  title: '还加不进去',
  content: e.message || '请检查邀请码，或先在本机记录。',
  confirmText: '知道了',
  cancelText: '返回',
  success: (res) => {
    if (res.cancel) this.skipJoin()
  }
})
```

不要 `showCancel: false`。

- [ ] **Step 4: 手测取消路径**

记录空状态 → 建一本 → 暂不登录 → 仍在记录；再进填资料 → 返回 → 欢迎页；加入页暂不加入 → 记录。全程不能出现只能点主按钮的死页。

---

### Task 3: 启动不登录，建账默认本地，云同步后置

**Files:**
- Modify: `miniprogram/utils/db.js`
- Modify: `miniprogram/pages/family/family.js`
- Modify: `miniprogram/pages/family/family.wxml`
- Modify: `tests/run.js`
- Test: `npm test`

**Interfaces:**
- Consumes: `config.cloudEnv`、`wx.cloud`、`createFamily` / `xiaoyaLogin` 云函数
- Produces:
  - `init()`：无 `xiaoya_current_family` 时不调 `xiaoyaLogin`
  - `createFamilyAndBaby(input)`：始终先本地；不再因 `cloudReady` 自动 `createFamily`
  - `enableCloudSync()`：用户确认后 `_loadCloud` + 若无成员则 `createFamily`
  - `snapshot().cloudReady` 含义保持：云环境可用；`mode === 'cloud'` 才表示已同步

- [ ] **Step 1: 写失败测试：无已存家庭时 init 保持 local**

在 `tests/run.js` 增加（node 下无 `wx.cloud`，现有 `init` 已走 local；补一条「create 后 mode 仍是 local」）：

```javascript
await test('create family stays local even after init', async () => {
  await db.init()
  await db.resetLocal()
  await db.createFamilyAndBaby({
    babyName: '小芽',
    birthday: '2026-01-01',
    gender: 'girl'
  })
  assertEq(db.snapshot().mode, 'local')
  assert(db.hasBaby())
})
```

Run: `npm test`  
Expected: PASS（改完 `createFamilyAndBaby` 后仍须 PASS；若你先改测试再改实现，当前实现 `cloudReady` 在测试环境为 false，本测试现在就会过）。

再加：`joinFamily` 空码仍抛错（已有用例，保持）。

- [ ] **Step 2: `init` 仅在已有家庭缓存时拉云**

`miniprogram/utils/db.js` `init`：

```javascript
async init() {
  this.cloudReady = false
  if (config.cloudEnv && typeof wx !== 'undefined' && wx.cloud) {
    try {
      wx.cloud.init({ env: config.cloudEnv, traceUser: true })
      this.cloudReady = true
      const storedFamilyId =
        (wx.getStorageSync && wx.getStorageSync('xiaoya_current_family')) || ''
      if (storedFamilyId) {
        const hasCloudFamily = await this._loadCloud(storedFamilyId)
        if (hasCloudFamily) {
          this.mode = 'cloud'
          this.ready = true
          this._startRecordWatch()
          this._notify()
          return this
        }
      }
    } catch (err) {
      console.warn('cloud init failed, fallback to local', err)
      this.cloudReady = false
    }
  }
  this.mode = 'local'
  this._loadLocal()
  this.ready = true
  this._notify()
  return this
}
```

首次审核号没有 `xiaoya_current_family`，不会调 `xiaoyaLogin`。

- [ ] **Step 3: `createFamilyAndBaby` 去掉自动上云**

删掉（或不再走）这段：

```javascript
if (this.cloudReady) {
  await wx.cloud.callFunction({ name: 'createFamily', ... })
  ...
}
```

只保留现在的本地 `this.state.family / members / babies` + `persist()` 分支。`mode` 保持 `'local'`。

- [ ] **Step 4: 新增 `enableCloudSync`**

```javascript
async enableCloudSync() {
  if (!this.cloudReady || typeof wx === 'undefined' || !wx.cloud) {
    throw new Error('还没开通云开发')
  }
  if (this.mode === 'cloud') return this.snapshot()
  const baby = this.currentBaby()
  if (!baby || !this.state.family) throw new Error('请先给宝宝建一本')
  await wx.cloud.callFunction({
    name: 'createFamily',
    data: {
      familyName: this.state.family.name,
      inviteCode: this.state.family.inviteCode,
      baby: {
        name: baby.name,
        birthday: baby.birthday,
        gender: baby.gender
      }
    }
  })
  const ok = await this._loadCloud()
  if (!ok) throw new Error('同步失败，请稍后重试')
  this.mode = 'cloud'
  this._startRecordWatch()
  this.persist()
  return this.snapshot()
}
```

若云函数 `createFamily` 在「已经在一个家庭里了」时抛错：`enableCloudSync` 应先 `_loadCloud()`，已有成员则直接 `mode = 'cloud'`，不要重复创建。

```javascript
const existed = await this._loadCloud()
if (existed) {
  this.mode = 'cloud'
  this._startRecordWatch()
  this.persist()
  return this.snapshot()
}
// 否则再 createFamily
```

- [ ] **Step 5: 家庭页「开通家庭同步」带取消**

`family.wxml` 在邀请码卡片、且 `mode !== 'cloud' && cloudReady` 时：

```xml
<button class="btn btn-primary mini" bindtap="enableCloud">开通家庭同步</button>
```

```javascript
enableCloud() {
  wx.showModal({
    title: '开通家庭同步',
    content: '开通后，家人可用邀请码加入同一本账。也可以先本机使用。',
    confirmText: '开通',
    cancelText: '取消',
    success: async (res) => {
      if (!res.confirm) return
      wx.showLoading({ title: '开通中' })
      try {
        await db.enableCloudSync()
        wx.hideLoading()
        this.refresh()
        wx.showToast({ title: '已开通', icon: 'success' })
      } catch (e) {
        wx.hideLoading()
        wx.showModal({
          title: '暂时开不了',
          content: e.message || '请稍后重试',
          showCancel: true,
          cancelText: '返回',
          confirmText: '知道了'
        })
      }
    }
  })
},
```

点取消：留在家庭页，本机记录继续可用。

- [ ] **Step 6: 跑测试**

Run: `npm test`  
Expected: 全部 PASS。

---

### Task 4: 审核手测清单（不写代码）

按审核员路径过一遍，全部要过才提审：

1. 清缓存，打开小程序：首页是「记录」，不是欢迎页。
2. 不点任何建账按钮：能看记录四宫格、时间轴、生长、家庭。
3. 点喝奶 → 弹窗有「暂不登录」→ 点它 → 仍在记录，不再弹、不跳欢迎页。
4. 点「给宝宝建一本」→ 欢迎页有「暂不登录，先看看」→ 回到记录。
5. 填资料页能「返回」到欢迎页。
6. 「我有邀请码」有「暂不加入」；失败弹窗能取消。
7. 走完本地建账后能记喝奶/睡眠/尿布。
8. 家庭页「开通家庭同步」点取消，仍能记；点开通才上云。
9. 不要出现循环：取消后再切 Tab 不应再次被强制进入欢迎页。

---

## Spec coverage

| 规范点 | 任务 |
| --- | --- |
| 未体验功能就要求登录 | Task 1：记录为落地页 |
| 登录页无取消/返回 | Task 2：暂不登录 / 返回 / 暂不加入 |
| 取消无响应或反复进入 | Task 1 去掉 redirect + modal 取消留在当前页 |
| 拒绝则无法使用全部服务 | Task 1–3：本机可浏览，建账后可记；云同步可选 |
| 云函数被当成登录 | Task 3：启动和建账不再自动 xiaoyaLogin/createFamily |

## 不在本次范围

- 不做手机号、头像昵称授权。
- 不改隐私指引文案（用户已在后台填）。
- 不默认生成名叫「宝宝」的账本（避免审核以外的用户数据困惑）；靠空状态先体验。
