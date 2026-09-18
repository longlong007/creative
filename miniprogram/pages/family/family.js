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
  },

  leaveConfirmContent() {
    const members = this.data.members || []
    if (members.length <= 1) {
      return '你是最后一个人。退出后这本账、宝宝和记录都会删掉，无法恢复。'
    }
    const snap = db.snapshot()
    const userId = snap.user && snap.user.id
    const me = members.find((m) => m.id === userId || m._openid === userId)
    const isCreator =
      (me && me.role === '创建者') ||
      (snap.family && snap.family.createdBy && snap.family.createdBy === userId)
    if (isCreator) {
      return '退出后，创建者会交给最早加入的家人。账本和记录会留下，你再也进不来。'
    }
    return '退出后你不能再看这本账。别人还在，记录会留下。'
  },

  leaveAccount() {
    wx.showModal({
      title: '退出家庭并删除账号',
      content: this.leaveConfirmContent(),
      confirmText: '退出',
      confirmColor: '#B54A3A',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '退出中' })
        try {
          await db.leaveAccount()
          wx.hideLoading()
          this.refresh()
          wx.showToast({ title: '已退出', icon: 'success' })
        } catch (e) {
          wx.hideLoading()
          wx.showModal({
            title: '暂时退不出',
            content: e.message || '请稍后重试',
            showCancel: false,
            confirmText: '知道了'
          })
        }
      }
    })
  }
})
