const db = require('../../utils/db')
const format = require('../../utils/format')
const config = require('../../config')

Page({
  data: {
    baby: null,
    ageText: '',
    family: null,
    members: [],
    babies: [],
    mode: 'local',
    cloudReady: false
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 })
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
    this.setData({
      baby: snap.baby,
      ageText: snap.baby && snap.baby.birthday ? format.ageText(snap.baby.birthday) : '',
      family: snap.family,
      members: snap.members,
      babies: snap.babies,
      mode: snap.mode,
      cloudReady: snap.cloudReady || Boolean(config.cloudEnv)
    })
  },

  copyCode() {
    const code = this.data.family && this.data.family.inviteCode
    if (!code) return
    wx.setClipboardData({ data: code })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/join/join' })
  },

  goEditBaby() {
    const id = this.data.baby && this.data.baby.id
    wx.navigateTo({ url: `/pages/baby-edit/baby-edit?id=${id}` })
  },

  addBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/baby-edit' })
  },

  async switchBaby(e) {
    await db.switchBaby(e.currentTarget.dataset.id)
    this.refresh()
    wx.showToast({ title: '已切换', icon: 'success' })
  },

  exportData() {
    const data = JSON.stringify(db.exportAll())
    wx.setClipboardData({
      data,
      success: () => wx.showToast({ title: '备份已复制', icon: 'success' })
    })
  },

  goInsights() {
    wx.navigateTo({ url: '/pages/insights/insights' })
  }
})
