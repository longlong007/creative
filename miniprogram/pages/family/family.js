const db = require('../../utils/db')
const format = require('../../utils/format')
const config = require('../../config')
const { showTabBar } = require('../../utils/tab')

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
    showTabBar(this, 3)
    await getApp().whenReady()
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

  goOnboarding() {
    wx.navigateTo({ url: '/pages/onboarding/onboarding' })
  },

  copyCode() {
    const code = this.data.family && this.data.family.inviteCode
    if (!code) return
    wx.setClipboardData({ data: code })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/join/join' })
  },

  enableCloud() {
    wx.showModal({
      title: '开通家庭同步',
      content: '开通后，家人可用邀请码加入同一本账。也可以先本机使用。',
      confirmText: '开通',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '开通中' })
        try {
          await db.enableCloudSync()
          wx.hideLoading()
          this.refresh()
          wx.showToast({ title: '已开通', icon: 'success' })
        } catch (e) {
          wx.hideLoading()
          wx.showModal({
            title: '暂时开不了',
            content: e.message || '请稍后重试',
            showCancel: true,
            cancelText: '返回',
            confirmText: '知道了'
          })
        }
      }
    })
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
