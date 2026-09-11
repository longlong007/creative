const db = require('../../utils/db')
const insights = require('../../utils/insights')
const format = require('../../utils/format')
const ai = require('../../utils/ai')

const CACHE_KEY = 'xiaoya_ai_cache_v1'

Page({
  data: {
    report: null,
    days: [],
    metrics: [],
    paragraphs: [],
    highlights: [],
    suggestions: [],
    rangeText: '',
    aiRanges: [
      { key: 'week', label: '本周' },
      { key: '7d', label: '近7天' },
      { key: '30d', label: '近30天' }
    ],
    aiRange: 'week',
    thinking: false,
    analyzing: false,
    aiParagraphs: [],
    aiMeta: '',
    aiError: '',
    canAnalyze: false
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
      rangeText: `${format.formatDate(report.from)} – ${format.formatDate(report.to)}`,
      canAnalyze: ai.canAnalyze()
    })
    this.restoreCache()
  },

  cacheKey() {
    const baby = db.currentBaby()
    return [baby && baby.id, this.data.aiRange, this.data.thinking ? 'think' : 'fast'].join(':')
  },

  restoreCache() {
    try {
      const cache = wx.getStorageSync(CACHE_KEY)
      if (!cache || cache.key !== this.cacheKey() || !cache.text) {
        return
      }
      const formatted = insights.formatAiText(cache.text)
      this.setData({
        aiParagraphs: formatted.paragraphs,
        aiMeta: cache.meta || '',
        aiError: ''
      })
    } catch (e) {
      // ignore
    }
  },

  saveCache(text, meta) {
    wx.setStorageSync(CACHE_KEY, {
      key: this.cacheKey(),
      text,
      meta,
      at: Date.now()
    })
  },

  setRange(e) {
    this.setData({ aiRange: e.currentTarget.dataset.key, aiError: '' })
    this.restoreCache()
  },

  toggleThinking() {
    this.setData({ thinking: !this.data.thinking, aiError: '' })
    this.restoreCache()
  },

  async runAnalyze() {
    if (this.data.analyzing) return
    if (!ai.canAnalyze()) {
      wx.showModal({
        title: '还没接上 DeepSeek',
        content: ai.setupHint(),
        showCancel: false
      })
      return
    }
    const snap = db.snapshot()
    const payload = insights.buildAiPayload(snap.baby, snap.records, this.data.aiRange)
    if (!payload.summary.recordCount) {
      this.setData({ aiError: '这一段还没什么记录，先记几条再分析' })
      return
    }
    this.setData({ analyzing: true, aiError: '' })
    wx.showLoading({ title: this.data.thinking ? '深度分析中' : '分析中', mask: true })
    try {
      const result = await ai.analyze({
        payload,
        thinking: this.data.thinking
      })
      const formatted = insights.formatAiText(result.text)
      const when = format.formatDateTime(Date.now())
      const meta = `${payload.rangeLabel} · ${result.model}${result.thinking ? ' · 深度思考' : ''} · ${when}`
      this.setData({
        aiParagraphs: formatted.paragraphs,
        aiMeta: meta,
        analyzing: false
      })
      this.saveCache(result.text, meta)
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      this.setData({
        analyzing: false,
        aiError: err.message || '分析失败'
      })
    }
  },

  copyPrompt() {
    const prompt = this.data.report && this.data.report.prompt
    if (!prompt) return
    wx.setClipboardData({
      data: prompt,
      success: () => wx.showToast({ title: '已复制给 AI 的说明', icon: 'success' })
    })
  },

  copyResult() {
    const text = (this.data.aiParagraphs || []).join('\n\n')
    if (!text) return
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制分析结果', icon: 'success' })
    })
  }
})
