const db = require('../../utils/db')
const insights = require('../../utils/insights')
const format = require('../../utils/format')

Page({
  data: {
    report: null,
    days: [],
    metrics: [],
    paragraphs: [],
    highlights: [],
    suggestions: [],
    rangeText: ''
  },

  async onShow() {
    await getApp().whenReady()
    const snap = db.snapshot()
    const report = insights.buildReport(snap.baby, snap.records)
    this.setData({
      report,
      days: report.days,
      metrics: report.metrics,
      paragraphs: report.paragraphs,
      highlights: report.highlights,
      suggestions: report.suggestions,
      rangeText: `${format.formatDate(report.from)} – ${format.formatDate(report.to)}`
    })
  },

  copyPrompt() {
    const prompt = this.data.report && this.data.report.prompt
    if (!prompt) return
    wx.setClipboardData({
      data: prompt,
      success: () => wx.showToast({ title: '已复制给 AI 的说明', icon: 'success' })
    })
  }
})
