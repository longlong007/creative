const { RECORD_TYPES } = require('./constants')
const format = require('./format')

function isBottleMilk(rec) {
  return rec.type === 'milk'
}

function isBreastfeed(rec) {
  return rec.type === 'breastfeed'
}

function isSleep(rec) {
  return rec.type === 'sleep'
}

function inRange(rec, from, to) {
  const t = rec.startAt
  return t >= from && t <= to
}

function aggregate(records, from, to, now) {
  const list = records || []
  const n = now != null ? now : Date.now()
  const rangeEnd = to
  let milkMl = 0
  let milkCount = 0
  let breastMin = 0
  let breastCount = 0
  let sleepMin = 0
  let diaperPee = 0
  let diaperPoop = 0
  let diaperCount = 0
  let solids = 0
  let notes = 0

  list.forEach((rec) => {
    if (isSleep(rec)) {
      const overlap = format.overlapMinutes(rec.startAt, rec.endAt, from, rangeEnd)
      sleepMin += overlap
      return
    }
    if (!inRange(rec, from, to)) return
    if (isBottleMilk(rec)) {
      milkMl += Number(rec.amount) || 0
      milkCount += 1
    } else if (isBreastfeed(rec)) {
      breastMin += Number(rec.durationMin) || Number(rec.amount) || 0
      breastCount += 1
    } else if (rec.type === 'diaper') {
      diaperCount += 1
      if (rec.subtype === 'pee' || rec.subtype === 'both') diaperPee += 1
      if (rec.subtype === 'poop' || rec.subtype === 'both') diaperPoop += 1
    } else if (rec.type === 'solid') {
      solids += 1
    } else if (rec.type === 'note') {
      notes += 1
    }
  })

  return {
    from,
    to,
    milkMl,
    milkCount,
    breastMin,
    breastCount,
    sleepMin,
    diaperPee,
    diaperPoop,
    diaperCount,
    solids,
    notes,
    now: n
  }
}

function todayStats(records, now) {
  const n = now != null ? now : Date.now()
  return aggregate(records, format.startOfDay(n, n), format.endOfDay(n, n), n)
}

function lastOfType(records, type, subtype) {
  const list = records || []
  for (let i = 0; i < list.length; i++) {
    const rec = list[i]
    if (rec.type !== type) continue
    if (subtype && rec.subtype !== subtype) continue
    return rec
  }
  return null
}

function activeSleep(records) {
  const list = records || []
  for (let i = 0; i < list.length; i++) {
    const rec = list[i]
    if (rec.type === 'sleep' && !rec.endAt) return rec
  }
  return null
}

function latestGrowth(records) {
  let height = null
  let weight = null
  ;(records || []).forEach((rec) => {
    if (rec.type === 'height' && !height) height = rec
    if (rec.type === 'weight' && !weight) weight = rec
  })
  return { height, weight }
}

function growthSeries(records, type) {
  return (records || [])
    .filter((rec) => rec.type === type && rec.amount != null)
    .slice()
    .sort((a, b) => a.startAt - b.startAt)
    .map((rec) => ({
      id: rec.id,
      t: rec.startAt,
      v: Number(rec.amount)
    }))
}

function averageIntervalMin(records, type, from, to) {
  const times = (records || [])
    .filter((rec) => rec.type === type && inRange(rec, from, to))
    .map((rec) => rec.startAt)
    .sort((a, b) => a - b)
  if (times.length < 2) return null
  let sum = 0
  for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1]
  return Math.round(sum / (times.length - 1) / 60000)
}

function longestSleepMin(records, from, to, now) {
  let max = 0
  ;(records || []).forEach((rec) => {
    if (rec.type !== 'sleep') return
    const overlap = format.overlapMinutes(rec.startAt, rec.endAt, from, to)
    if (overlap > max) max = overlap
  })
  return max
}

function typeMeta(type) {
  return RECORD_TYPES[type] || RECORD_TYPES.note
}

function recordTitle(rec) {
  const meta = typeMeta(rec.type)
  if (rec.type === 'milk') {
    const name = rec.subtype === 'breast_bottle' ? '母乳瓶喂' : '配方奶'
    return `${name} ${rec.amount || 0}ml`
  }
  if (rec.type === 'breastfeed') {
    const side = rec.subtype === 'left' ? '左侧' : rec.subtype === 'right' ? '右侧' : '双侧'
    const min = rec.durationMin || rec.amount || 0
    return `亲喂·${side} ${format.formatDurationMin(min)}`
  }
  if (rec.type === 'sleep') {
    if (!rec.endAt) return '睡眠中'
    return `睡眠 ${format.formatDurationMin(rec.durationMin)}`
  }
  if (rec.type === 'diaper') {
    if (rec.subtype === 'poop') return '便便'
    if (rec.subtype === 'both') return '嘘嘘 + 便便'
    return '嘘嘘'
  }
  if (rec.type === 'height') return `身高 ${rec.amount}cm`
  if (rec.type === 'weight') return `体重 ${rec.amount}kg`
  if (rec.type === 'temperature') return `体温 ${rec.amount}°C`
  if (rec.type === 'solid') return rec.subtype ? `辅食 ${rec.subtype}` : rec.note ? `辅食 ${rec.note}` : '辅食'
  if (rec.note) return rec.note
  return meta.label
}

function recordTimeLabel(rec) {
  if (rec.type === 'sleep' && rec.endAt) {
    return `${format.formatTime(rec.startAt)}–${format.formatTime(rec.endAt)}`
  }
  return format.formatTime(rec.startAt)
}

module.exports = {
  aggregate,
  todayStats,
  lastOfType,
  activeSleep,
  latestGrowth,
  growthSeries,
  averageIntervalMin,
  longestSleepMin,
  typeMeta,
  recordTitle,
  recordTimeLabel
}
