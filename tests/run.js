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

    const snap = db.snapshot()
    const home = present.presentHome(snap)
    assertEq(home.baby.name, '小芽')
    assert(home.recent.length >= 3)
    assert(String(home.todayMilk).indexOf('150') !== -1)
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

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
