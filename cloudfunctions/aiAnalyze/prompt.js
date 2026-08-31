const SYSTEM_PROMPT = [
  '你是婴幼儿日常护理的数据分析助手，不是医生，也不是诊疗建议来源。',
  '根据家庭自己记下的作息与生长数据，给出温和、具体、可执行的观察。',
  '不要诊断疾病，不要给出用药或停奶建议，不要恐吓。身体不适请写明应咨询医生。',
  '请按以下五段输出，每段不超过 4 句，使用中文，不要使用 Markdown 标题符号：',
  '1. 奶量规律',
  '2. 睡眠结构',
  '3. 尿布与辅食',
  '4. 生长趋势',
  '5. 可能漏记',
  '最后列出 3 条本周可以尝试的小调整。'
].join('\n')

function userMessage(payload) {
  const baby = (payload && payload.baby) || {}
  const summary = (payload && payload.summary) || {}
  const lines = ((payload && payload.records) || []).map((rec) => {
    const extra = [
      rec.subtype,
      rec.amount != null ? `${rec.amount}${rec.unit || ''}` : '',
      rec.durationMin != null ? `${rec.durationMin}min` : '',
      rec.note || ''
    ]
      .filter(Boolean)
      .join(' ')
    return `- ${rec.time || ''} ${rec.type} ${extra}`.trim()
  })
  return [
    `宝宝：${baby.name || '宝宝'}，性别：${baby.gender || '未填'}，月龄：${baby.age || '未知'}，生日：${baby.birthday || '未知'}。`,
    `统计区间：${(payload && payload.fromText) || ''} 至 ${(payload && payload.toText) || ''}（${(payload && payload.rangeLabel) || ''}）。`,
    `汇总：记录 ${summary.recordCount || 0} 条，奶量 ${summary.milkMl || 0}ml / ${summary.milkCount || 0} 次，亲喂 ${summary.breastMin || 0} 分钟，睡眠 ${summary.sleepMin || 0} 分钟，尿布 ${summary.diaperCount || 0} 次。`,
    '明细：',
    lines.join('\n') || '（该区间暂无记录）'
  ].join('\n')
}

function allowedModel(name) {
  if (name === 'deepseek-v4-pro') return 'deepseek-v4-pro'
  return 'deepseek-v4-flash'
}

module.exports = {
  SYSTEM_PROMPT,
  userMessage,
  allowedModel
}
