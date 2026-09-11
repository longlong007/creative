const path = require('path')

function load(rel) {
  return require(path.join(__dirname, '..', 'miniprogram', rel))
}

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    const ret = fn()
    if (ret && typeof ret.then === 'function') {
      return ret.then(() => {
        passed += 1
        console.log('ok  ' + name)
      }).catch((err) => {
        failed += 1
        console.log('FAIL  ' + name)
        console.log('     ' + (err.stack || err.message))
      })
    }
    passed += 1
    console.log('ok  ' + name)
    return Promise.resolve()
  } catch (err) {
    failed += 1
    console.log('FAIL  ' + name)
    console.log('     ' + (err.stack || err.message))
    return Promise.resolve()
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed')
}

function assertEq(a, b, message) {
  if (a !== b) throw new Error((message || 'not equal') + ` | ${JSON.stringify(a)} !== ${JSON.stringify(b)}`)
}

async function run() {
  const format = load('utils/format')
  const stats = load('utils/stats')
  const insights = load('utils/insights')
  const { inviteCode } = load('utils/id')
  const present = load('utils/present')
  const db = load('utils/db')
  const { SOLID_FOODS, mergeSolidFoods } = load('utils/constants')

  const now = new Date(2026, 7, 31, 15, 0, 0).getTime()

  await test('ageText: months and days', () => {
    assertEq(format.ageText('2026-01-01', now), '7个月30天')
  })

  await test('ageText: one year', () => {
    assertEq(format.ageText('2025-08-31', now), '1岁')
  })

  await test('ageText: days only', () => {
    assertEq(format.ageText('2026-08-20', now), '11天')
  })

  await test('toTs and nowDateTime', () => {
    assertEq(format.toTs('2026-08-31', '15:00'), now)
    const parts = format.nowDateTime(now)
    assertEq(parts.date, '2026-08-31')
    assertEq(parts.time, '15:00')
  })

  await test('formatDurationMin', () => {
    assertEq(format.formatDurationMin(45), '45分钟')
    assertEq(format.formatDurationMin(80), '1小时20分')
    assertEq(format.formatDurationMin(120), '2小时')
  })

  await test('formatAgo', () => {
    assertEq(format.formatAgo(now - 20 * 1000, now), '刚刚')
    assertEq(format.formatAgo(now - 5 * 60 * 1000, now), '5分钟前')
    assertEq(format.formatAgo(now - 3 * 60 * 60 * 1000, now), '3小时前')
  })

  await test('sleep overlap across midnight', () => {
    const start = new Date(2026, 7, 30, 23, 0, 0).getTime()
    const end = new Date(2026, 7, 31, 1, 10, 0).getTime()
    const from = format.startOfDay(now, now)
    const to = format.endOfDay(now, now)
    assertEq(format.overlapMinutes(start, end, from, to), 70)
  })

  await test('invite code charset and length', () => {
    const code = inviteCode(6)
    assertEq(code.length, 6)
    assert(/^[A-HJ-NP-Z2-9]+$/.test(code))
  })

  await test('today milk and diaper stats', () => {
    const records = [
      { type: 'milk', amount: 120, startAt: now - 3600000 },
      { type: 'milk', amount: 90, startAt: now - 1800000 },
      { type: 'diaper', subtype: 'both', startAt: now - 60000 },
      { type: 'milk', amount: 80, startAt: now - 48 * 3600000 }
    ]
    const t = stats.todayStats(records, now)
    assertEq(t.milkMl, 210)
    assertEq(t.milkCount, 2)
    assertEq(t.diaperCount, 1)
    assertEq(t.diaperPee, 1)
    assertEq(t.diaperPoop, 1)
  })

  await test('active sleep and title', () => {
    const rec = { type: 'sleep', startAt: now - 20 * 60000, endAt: null, durationMin: null }
    assert(stats.activeSleep([rec]))
    assertEq(stats.recordTitle(rec), '睡眠中')
  })

  await test('record titles', () => {
    assertEq(stats.recordTitle({ type: 'milk', subtype: 'formula', amount: 120 }), '配方奶 120ml')
    assertEq(stats.recordTitle({ type: 'breastfeed', subtype: 'left', durationMin: 12 }), '亲喂·左侧 12分钟')
    assertEq(stats.recordTitle({ type: 'diaper', subtype: 'poop' }), '便便')
    assertEq(stats.recordTitle({ type: 'solid', subtype: '南瓜泥' }), '辅食 南瓜泥')
    assertEq(stats.recordTitle({ type: 'solid' }), '辅食')
  })

  await test('home recent only includes today', () => {
    const todayMilk = { id: '1', type: 'milk', amount: 120, startAt: now - 3600000 }
    const todayDiaper = { id: '2', type: 'diaper', subtype: 'pee', startAt: now - 60000 }
    const yesterdayMilk = { id: '3', type: 'milk', amount: 80, startAt: now - 48 * 3600000 }
    const overnightSleep = {
      id: '4',
      type: 'sleep',
      startAt: new Date(2026, 7, 30, 23, 0, 0).getTime(),
      endAt: new Date(2026, 7, 31, 7, 0, 0).getTime()
    }
    const yesterdaySleep = {
      id: '5',
      type: 'sleep',
      startAt: new Date(2026, 7, 30, 14, 0, 0).getTime(),
      endAt: new Date(2026, 7, 30, 16, 0, 0).getTime()
    }
    const home = present.presentHome({
      baby: { name: '小芽', birthday: '2026-01-01' },
      records: [todayDiaper, todayMilk, overnightSleep, yesterdayMilk, yesterdaySleep]
    }, now)
    assertEq(home.recent.length, 3)
    assertEq(home.recent[0].id, '2')
    assertEq(home.recent[1].id, '1')
    assertEq(home.recent[2].id, '4')
  })

  await test('db local family and quick records', async () => {
    await db.init()
    await db.resetLocal()
    await db.createFamilyAndBaby({
      babyName: '小芽',
      birthday: '2026-01-01',
      gender: 'girl'
    })
    assert(db.hasBaby())
    assertEq(db.currentBaby().name, '小芽')
    assertEq(db.snapshot().family.inviteCode.length, 6)

    await db.addRecord({ type: 'milk', subtype: 'formula', amount: 150, unit: 'ml', startAt: Date.now(), source: 'quick' })
    await db.addRecord({ type: 'diaper', subtype: 'pee', startAt: Date.now() })
    const sleep = await db.startSleep()
    assert(sleep && !sleep.endAt)
    const ended = await db.endSleep()
    assert(ended.endAt)
    assert(ended.durationMin >= 1 || ended.durationMin === 1 || ended.durationMin >= 0)

    const edited = await db.updateRecord(ended.id, {
      startAt: ended.startAt,
      endAt: ended.startAt + 90 * 60000
    })
    assertEq(edited.durationMin, 90)

    const snap = db.snapshot()
    const home = present.presentHome(snap)
    assertEq(home.baby.name, '小芽')
    assert(home.recent.length >= 3)
    assert(String(home.todayMilk).indexOf('150') !== -1)
  })

  await test('solid foods default and custom', async () => {
    await db.init()
    await db.resetLocal()
    await db.createFamilyAndBaby({
      babyName: '小芽',
      birthday: '2026-01-01',
      gender: 'girl'
    })
    const defaults = db.listSolidFoods()
    assertEq(defaults.length, SOLID_FOODS.length)
    assert(defaults.indexOf('婴儿米粉') >= 0)
    const merged = mergeSolidFoods(['豆腐'], ['南瓜泥', '豆腐'])
    assertEq(merged[0], '婴儿米粉')
    assert(merged.indexOf('豆腐') >= 0)
    const foods = await db.addSolidFood('豆腐')
    assert(foods.indexOf('豆腐') >= 0)
    const rec = await db.addRecord({ type: 'solid', subtype: '豆腐', startAt: Date.now(), source: 'manual' })
    assertEq(stats.recordTitle(rec), '辅食 豆腐')
  })

  await test('insights prompt is AI-ready', async () => {
    const snap = db.snapshot()
    const report = insights.buildReport(snap.baby, snap.records)
    assert(report.prompt.indexOf('小芽') !== -1)
    assert(report.prompt.indexOf('不是医生') !== -1)
    assert(report.metrics.length === 4)
    assert(Array.isArray(report.days))
    assertEq(report.days.length, 7)
  })

  await test('join family rejects empty code', async () => {
    let threw = false
    try {
      await db.joinFamily(' ')
    } catch (e) {
      threw = true
    }
    assert(threw)
  })

  await test('resolveRange 7d and 30d', () => {
    const week = insights.resolveRange('week', now)
    const d7 = insights.resolveRange('7d', now)
    const d30 = insights.resolveRange('30d', now)
    assertEq(week.label, '本周')
    assertEq(d7.label, '近7天')
    assertEq(format.formatYmd(d7.from), '2026-08-25')
    assertEq(format.formatYmd(d30.from), '2026-08-02')
  })

  await test('buildAiPayload compact records', () => {
    const baby = { name: '小芽', birthday: '2026-01-01', gender: 'girl' }
    const records = [
      { type: 'milk', subtype: 'formula', amount: 120, unit: 'ml', startAt: now - 3600000, durationMin: null, note: '' }
    ]
    const payload = insights.buildAiPayload(baby, records, '7d', now)
    assertEq(payload.baby.name, '小芽')
    assertEq(payload.summary.milkMl, 120)
    assertEq(payload.summary.recordCount, 1)
    assert(payload.records[0].time.indexOf('2026-08-31') !== -1)
  })

  await test('formatAiText strips markdown', () => {
    const out = insights.formatAiText('## 奶量规律\n\n**日均偏稳**\n\n- 可能漏记午睡')
    assert(out.paragraphs.length >= 2)
    assert(out.text.indexOf('##') === -1)
    assert(out.text.indexOf('**') === -1)
    assert(out.text.indexOf('· 可能漏记午睡') !== -1)
  })

  await test('ai prompt helpers stay in sync', () => {
    const appPrompt = require('../miniprogram/utils/ai-prompt')
    const fnPrompt = require('../cloudfunctions/aiAnalyze/prompt')
    assertEq(appPrompt.SYSTEM_PROMPT, fnPrompt.SYSTEM_PROMPT)
    assertEq(appPrompt.allowedModel('deepseek-chat'), 'deepseek-v4-flash')
    assertEq(appPrompt.allowedModel('deepseek-v4-pro'), 'deepseek-v4-pro')
    const msg = appPrompt.userMessage({
      baby: { name: '小芽', gender: '女', age: '7个月', birthday: '2026-01-01' },
      fromText: '2026-08-25',
      toText: '2026-08-31',
      rangeLabel: '近7天',
      summary: { recordCount: 1, milkMl: 120, milkCount: 1, breastMin: 0, sleepMin: 0, diaperCount: 0 },
      records: [{ time: '2026-08-31 14:00', type: 'milk', subtype: 'formula', amount: 120, unit: 'ml' }]
    })
    assert(msg.indexOf('小芽') !== -1)
    assert(msg.indexOf('120ml') !== -1)
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
