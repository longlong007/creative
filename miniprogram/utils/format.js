function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseDate(input) {
  if (input instanceof Date) return new Date(input.getTime())
  if (typeof input === 'number') return new Date(input)
  const m = String(input || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function startOfDay(ts, now) {
  const d = new Date(ts != null ? ts : (now || Date.now()))
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function endOfDay(ts, now) {
  return startOfDay(ts, now) + 24 * 60 * 60 * 1000 - 1
}

function addDays(ts, days) {
  return ts + days * 24 * 60 * 60 * 1000
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatDate(ts, withYear) {
  const d = new Date(ts)
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  return withYear ? `${d.getFullYear()}年${md}` : md
}

function formatDateTime(ts) {
  return `${formatDate(ts)} ${formatTime(ts)}`
}

function formatYmd(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatDurationMin(min) {
  const n = Math.max(0, Math.round(Number(min) || 0))
  if (n < 1) return '不足1分钟'
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h && m) return `${h}小时${m}分`
  if (h) return `${h}小时`
  return `${m}分钟`
}

function formatAgo(ts, now) {
  const t = Number(ts)
  const n = now != null ? now : Date.now()
  const diff = n - t
  if (diff < 45 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`
  if (startOfDay(t, n) === startOfDay(addDays(n, -1), n)) {
    return `昨天 ${formatTime(t)}`
  }
  return formatDateTime(t)
}

function ageParts(birthday, now) {
  const b = parseDate(birthday)
  const n = new Date(now != null ? now : Date.now())
  if (n < b) return { years: 0, months: 0, days: 0 }

  let years = n.getFullYear() - b.getFullYear()
  let months = n.getMonth() - b.getMonth()
  let days = n.getDate() - b.getDate()

  if (days < 0) {
    months -= 1
    const prev = new Date(n.getFullYear(), n.getMonth(), 0)
    days += prev.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years, months, days }
}

function ageText(birthday, now) {
  const { years, months, days } = ageParts(birthday, now)
  if (years <= 0 && months <= 0) return `${days}天`
  if (years <= 0) return days ? `${months}个月${days}天` : `${months}个月`
  if (months) return `${years}岁${months}个月`
  return `${years}岁`
}

function overlapMinutes(start, end, rangeStart, rangeEnd) {
  const s = Math.max(Number(start) || 0, rangeStart)
  const e = Math.min(end != null ? Number(end) : Date.now(), rangeEnd)
  return Math.max(0, Math.round((e - s) / 60000))
}

module.exports = {
  pad2,
  parseDate,
  startOfDay,
  endOfDay,
  addDays,
  formatTime,
  formatDate,
  formatDateTime,
  formatYmd,
  formatDurationMin,
  formatAgo,
  ageParts,
  ageText,
  overlapMinutes
}
