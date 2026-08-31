const db = require('../../utils/db')
const present = require('../../utils/present')

Page({
  data: {
    groups: [],
    filter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'milk', label: '喝奶' },
      { key: 'sleep', label: '睡眠' },
      { key: 'diaper', label: '尿布' },
      { key: 'growth', label: '生长' }
    ]
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    await getApp().whenReady()
    if (!db.hasBaby()) {
      wx.redirectTo({ url: '/pages/onboarding/onboarding' })
      return
    }
    this.refresh()
  },

  refresh() {
    const snap = db.snapshot()
    let records = snap.records
    const f = this.data.filter
    if (f === 'milk') records = records.filter((r) => r.type === 'milk' || r.type === 'breastfeed')
    else if (f === 'sleep') records = records.filter((r) => r.type === 'sleep')
    else if (f === 'diaper') records = records.filter((r) => r.type === 'diaper')
    else if (f === 'growth') records = records.filter((r) => r.type === 'height' || r.type === 'weight')
    this.setData({ groups: present.presentTimeline(records) })
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key })
    this.refresh()
  },

  editRecord(e) {
    wx.navigateTo({ url: `/pages/record-edit/record-edit?id=${e.detail.id}` })
  }
})
