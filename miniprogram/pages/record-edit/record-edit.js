const db = require('../../utils/db')
const stats = require('../../utils/stats')
const format = require('../../utils/format')
const { RECORD_TYPES } = require('../../utils/constants')

Page({
  data: {
    id: '',
    rec: null,
    title: '',
    amount: '',
    note: '',
    date: '',
    time: '',
    endDate: '',
    endTime: '',
    durationMin: '',
    isNewSleep: false
  },

  async onLoad(query) {
    await getApp().whenReady()
    if (query.type === 'sleep' && !query.id) {
      const now = Date.now()
      this.setData({
        isNewSleep: true,
        rec: { type: 'sleep' },
        title: '补记睡眠',
        date: format.formatYmd(now),
        time: format.formatTime(now),
        endDate: format.formatYmd(now),
        endTime: format.formatTime(now),
        note: ''
      })
      return
    }
    const rec = db.getRecord(query.id)
    if (!rec) {
      wx.showToast({ title: '找不到这条', icon: 'none' })
      return
    }
    const endTs = rec.endAt || Date.now()
    this.setData({
      id: rec.id,
      rec,
      title: stats.recordTitle(rec),
      amount: rec.amount != null ? String(rec.amount) : '',
      note: rec.note || '',
      date: format.formatYmd(rec.startAt),
      time: format.formatTime(rec.startAt),
      endDate: format.formatYmd(endTs),
      endTime: format.formatTime(endTs),
      durationMin: rec.durationMin != null ? String(rec.durationMin) : '',
      meta: RECORD_TYPES[rec.type]
    })
  },

  onAmount(e) {
    this.setData({ amount: e.detail.value })
  },

  onNote(e) {
    this.setData({ note: e.detail.value })
  },

  onDate(e) {
    this.setData({ date: e.detail.value })
  },

  onTime(e) {
    this.setData({ time: e.detail.value })
  },

  onEndDate(e) {
    this.setData({ endDate: e.detail.value })
  },

  onEndTime(e) {
    this.setData({ endTime: e.detail.value })
  },

  async save() {
    const startAt = format.toTs(this.data.date, this.data.time)
    if (this.data.isNewSleep) {
      const endAt = format.toTs(this.data.endDate, this.data.endTime)
      if (endAt <= startAt) {
        wx.showToast({ title: '醒来要晚于入睡', icon: 'none' })
        return
      }
      await db.addRecord({
        type: 'sleep',
        startAt,
        endAt,
        note: this.data.note,
        source: 'manual'
      })
      wx.showToast({ title: '记下了', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }
    const patch = {
      startAt,
      note: this.data.note
    }
    if (this.data.rec.type === 'sleep') {
      const endAt = format.toTs(this.data.endDate, this.data.endTime)
      if (endAt <= startAt) {
        wx.showToast({ title: '醒来要晚于入睡', icon: 'none' })
        return
      }
      patch.endAt = endAt
    }
    if (this.data.amount !== '') patch.amount = Number(this.data.amount)
    await db.updateRecord(this.data.id, patch)
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 400)
  },

  remove() {
    wx.showModal({
      title: '删掉这条？',
      content: '删了就不能恢复',
      success: async (res) => {
        if (!res.confirm) return
        await db.deleteRecord(this.data.id)
        wx.navigateBack()
      }
    })
  }
})
