const format = require('./format')
const stats = require('./stats')

function weekStart(now) {
  const n = new Date(now != null ? now : Date.now())
  const day = n.getDay()
  const diff = day === 0 ? 6 : day - 1
  const start = format.startOfDay(n.getTime() - diff * 86400000, n.getTime())
  return start
}

function buildDaySeries(records, from, days, now) {
  const result = []
  for (let i = 0; i < days; i++) {
    const start = format.addDays(from, i)
    const end = format.endOfDay(start, start)
    const agg = stats.aggregate(records, start, end, now)
    result.push({
      date: start,
      label: `${new Date(start).getMonth() + 1}/${new Date(start).getDate()}`,
      weekday: '一二三四五六日'.charAt((new Date(start).getDay() + 6) % 7),
      ...agg
    })
  }
  return result
}

function avg(nums) {
  const list = nums.filter((n) => n != null)
  if (!list.length) return 0
  return Math.round(list.reduce((a, b) => a + b, 0) / list.length)
}

function buildReport(baby, records, now) {
  const n = now != null ? now : Date.now()
  const from = weekStart(n)
  const to = format.endOfDay(n, n)
  const days = buildDaySeries(records, from, 7, n)
  const lived = days.filter((d) => d.date <= n)
  const milkDays = lived.filter((d) => d.milkCount > 0 || d.breastCount > 0)
  const avgMilk = avg(lived.map((d) => d.milkMl))
  const avgSleep = avg(lived.map((d) => d.sleepMin))
  const avgDiaper = avg(lived.map((d) => d.diaperCount))
  const milkInterval = stats.averageIntervalMin(records, 'milk', from, to)
  const longest = stats.longestSleepMin(records, from, to, n)
  const growth = stats.latestGrowth(records)
  const age = baby && baby.birthday ? format.ageText(baby.birthday, n) : ''

  const highlights = []
  const cautions = []
  const suggestions = []

  if (avgMilk > 0) highlights.push(`这周日均奶量约 ${avgMilk}ml`)
  if (avgSleep > 0) highlights.push(`日均睡眠 ${format.formatDurationMin(avgSleep)}`)
  if (longest >= 180) highlights.push(`最长一觉睡了 ${format.formatDurationMin(longest)}`)
  if (milkInterval) highlights.push(`瓶喂间隔大约 ${format.formatDurationMin(milkInterval)}`)
  if (avgDiaper > 0) highlights.push(`日均尿布 ${avgDiaper} 次`)

  const noMilkDays = lived.filter((d) => d.milkCount === 0 && d.breastCount === 0 && d.date < format.startOfDay(n, n)).length
  if (noMilkDays >= 2) cautions.push(`有 ${noMilkDays} 天几乎没有奶量记录，可能是漏记`)
  const shortSleepDays = lived.filter((d) => d.sleepMin > 0 && d.sleepMin < 480 && d.date < format.startOfDay(n, n))
  if (shortSleepDays.length >= 3 && avgSleep < 600) {
    cautions.push('有几天睡眠明显偏短，看看是漏记还是作息乱了')
  }
  if (!growth.weight && !growth.height) {
    suggestions.push('抽空补一条身高或体重，后面做生长曲线会更好用')
  } else {
    suggestions.push('身高体重建议每周或每两周量一次，同一时间段更准')
  }
  if (!milkDays.length && !lived.some((d) => d.sleepMin > 0)) {
    suggestions.push('先从喝奶或睡觉记起，记的越多，后面 AI 洞察越准')
  } else {
    suggestions.push('继续用首页大按钮随手记，家人都能往同一本账里写')
  }

  const paragraphs = []
  const name = (baby && baby.name) || '宝宝'
  paragraphs.push(`${name}${age ? `（${age}）` : ''}这周一共记下 ${countRecords(records, from, to)} 条。`)
  if (avgMilk || avgSleep) {
    paragraphs.push(
      `喝奶和睡眠是目前最完整的两条线：奶量日均 ${avgMilk || 0}ml，睡眠日均 ${format.formatDurationMin(avgSleep)}。`
    )
  }
  if (cautions.length) paragraphs.push(cautions[0] + '。')
  paragraphs.push('这些观察来自你们自己的记录，不是诊断；身体不舒服请咨询医生。')

  const metrics = [
    { key: 'milk', label: '日均奶量', value: avgMilk ? `${avgMilk}ml` : '—' },
    { key: 'sleep', label: '日均睡眠', value: avgSleep ? format.formatDurationMin(avgSleep) : '—' },
    { key: 'diaper', label: '日均尿布', value: avgDiaper ? `${avgDiaper}次` : '—' },
    { key: 'longest', label: '最长一觉', value: longest ? format.formatDurationMin(longest) : '—' }
  ]

  return {
    from,
    to,
    days,
    highlights,
    cautions,
    suggestions,
    paragraphs,
    metrics,
    avgMilk,
    avgSleep,
    prompt: buildAiPrompt(baby, records, from, to, n)
  }
}

function countRecords(records, from, to) {
  return (records || []).filter((rec) => {
    if (rec.type === 'sleep') {
      return format.overlapMinutes(rec.startAt, rec.endAt, from, to) > 0
    }
    return rec.startAt >= from && rec.startAt <= to
  }).length
}

function buildAiPrompt(baby, records, from, to, now) {
  const name = (baby && baby.name) || '宝宝'
  const genderMap = { girl: '女', boy: '男', unknown: '未填' }
  const gender = genderMap[(baby && baby.gender) || 'unknown'] || '未填'
  const age = baby && baby.birthday ? format.ageText(baby.birthday, now) : '未知'
  const compact = (records || [])
    .filter((rec) => rec.startAt >= from || (rec.type === 'sleep' && rec.endAt && rec.endAt >= from))
    .slice(0, 400)
    .map((rec) => {
      const time = format.formatYmd(rec.startAt) + ' ' + format.formatTime(rec.startAt)
      const extra = [
        rec.subtype,
        rec.amount != null ? `${rec.amount}${rec.unit || ''}` : '',
        rec.durationMin != null ? `${rec.durationMin}min` : '',
        rec.note || ''
      ]
        .filter(Boolean)
        .join(' ')
      return `- ${time} ${rec.type} ${extra}`.trim()
    })
    .join('\n')

  return [
    '你是婴幼儿日常护理的数据分析助手，不是医生。请根据家庭记录给出温和、可执行的观察，不要诊断疾病，不要恐吓。',
    `宝宝：${name}，性别：${gender}，月龄：${age}，生日：${(baby && baby.birthday) || '未知'}。`,
    `统计区间：${format.formatYmd(from)} 至 ${format.formatYmd(to)}。`,
    '请按「奶量规律 / 睡眠结构 / 尿布与辅食 / 生长趋势 / 可能漏记」五段写，每段不超过 4 句。最后给 3 条本周可以尝试的小调整。',
    '记录如下：',
    compact || '（本周暂无记录）'
  ].join('\n')
}

module.exports = {
  weekStart,
  buildDaySeries,
  buildReport,
  buildAiPrompt
}
