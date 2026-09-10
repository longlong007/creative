const format = require('./format')
const stats = require('./stats')
const { MILK_SUBTYPES, DIAPER_SUBTYPES, MILK_AMOUNTS, BREAST_MINUTES, TIME_OFFSETS, MORE_ACTIONS } = require('./constants')

function presentHome(snap, now) {
  const n = now != null ? now : Date.now()
  const baby = snap.baby
  const records = snap.records || []
  const today = stats.todayStats(records, n)
  const lastMilk = stats.lastOfType(records, 'milk') || stats.lastOfType(records, 'breastfeed')
  const sleep = stats.activeSleep(records)
  const lastAmount = lastMilk && lastMilk.type === 'milk' ? lastMilk.amount : 120

  const dayStart = format.startOfDay(n, n)
  const dayEnd = format.endOfDay(n, n)

  return {
    mode: snap.mode,
    baby,
    ageText: baby && baby.birthday ? format.ageText(baby.birthday, n) : '',
    todayMilk: today.milkMl ? `${today.milkMl}ml` : '—',
    todaySleep: today.sleepMin ? format.formatDurationMin(today.sleepMin) : '—',
    todayDiaper: today.diaperCount ? `${today.diaperCount}次` : '—',
    lastMilk,
    lastMilkAgo: lastMilk ? format.formatAgo(lastMilk.startAt, n) : '',
    lastMilkTitle: lastMilk ? stats.recordTitle(lastMilk) : '还没有喝奶记录',
    lastAmount: lastAmount || 120,
    activeSleep: sleep,
    activeSleepText: sleep ? format.formatDurationMin((n - sleep.startAt) / 60000) : '',
    recent: records.filter((rec) => rec.startAt >= dayStart && rec.startAt <= dayEnd)
  }
}

function presentTimeline(records, now) {
  const n = now != null ? now : Date.now()
  const groups = []
  const map = {}
  ;(records || []).forEach((rec) => {
    const key = format.startOfDay(rec.startAt, n)
    if (!map[key]) {
      map[key] = {
        key,
        dateText: key === format.startOfDay(n, n) ? '今天' : format.formatDate(key),
        stats: null,
        records: []
      }
      groups.push(map[key])
    }
    map[key].records.push(rec)
  })
  groups.forEach((g) => {
    const agg = stats.aggregate(g.records, g.key, format.endOfDay(g.key, n), n)
    const bits = []
    if (agg.milkMl) bits.push(`奶 ${agg.milkMl}ml`)
    if (agg.sleepMin) bits.push(`睡 ${format.formatDurationMin(agg.sleepMin)}`)
    if (agg.diaperCount) bits.push(`尿布 ${agg.diaperCount}`)
    if (agg.solids) bits.push(`辅食 ${agg.solids}`)
    g.summary = bits.join(' · ') || '暂无汇总'
  })
  return groups
}

module.exports = {
  presentHome,
  presentTimeline,
  MILK_SUBTYPES,
  DIAPER_SUBTYPES,
  MILK_AMOUNTS,
  BREAST_MINUTES,
  TIME_OFFSETS,
  MORE_ACTIONS
}
