const db = require('../../utils/db')
const format = require('../../utils/format')
const config = require('../../config')
const { showTabBar, hideTabBar } = require('../../utils/tab')

function nickInitial(name) {
  const text = String(name || '').trim()
  if (!text) return '匿'
  if (text === '匿名用户') return '匿'
  return text[0]
}

Page({
  data: {
    baby: null,
    ageText: '',
    family: null,
    members: [],
    babies: [],
    mode: 'local',
    cloudReady: false,
    userId: '',
    displayNick: '匿名用户',
    nickInitial: '匿',
    nickEditOpen: false,
    nickDraft: '',
    authStatus: 'guest',
    authLabel: '未建账'
  },

  async onShow() {
    showTabBar(this, 3)
    await getApp().whenReady()
    this.refresh()
    if (this.data.nickEditOpen) hideTabBar(this)
  },

  refresh() {
    const snap = db.snapshot()
    const nick = (snap.user && snap.user.nickName) || '匿名用户'
    this.setData({
      baby: snap.baby,
      ageText: snap.baby && snap.baby.birthday ? format.ageText(snap.baby.birthday) : '',
      family: snap.family,
      members: snap.members,
      babies: snap.babies,
      mode: snap.mode,
      cloudReady: snap.cloudReady || Boolean(config.cloudEnv),
      userId: (snap.user && snap.user.id) || '',
      displayNick: nick,
      nickInitial: nickInitial(nick),
      authStatus: snap.authStatus || 'guest',
      authLabel: snap.authStatus === 'cloud' ? '已同步' : (snap.authStatus === 'local' ? '本机账本' : '未建账')
    })
  },

  noop() {},

  openNickEdit() {
    if (!this.data.baby) return
    hideTabBar(this)
    this.setData({
      nickEditOpen: true,
      nickDraft: this.data.displayNick === '匿名用户' ? '' : this.data.displayNick
    })
  },

  closeNickEdit() {
    this.setData({ nickEditOpen: false, nickDraft: '' })
    showTabBar(this, 3)
  },

  onNickDraft(e) {
    this.setData({ nickDraft: e.detail.value })
  },

  async saveNick() {
    const name = (this.data.nickDraft || '').trim()
    if (!name) {
      wx.showToast({ title: '先写你的昵称', icon: 'none' })
      return
    }
    if (name === '匿名用户') {
      wx.showToast({ title: '请换一个昵称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      await db.updateNickName(name)
      wx.hideLoading()
      this.closeNickEdit()
      this.refresh()
      wx.showToast({ title: '已更新', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    }
  },

  onMemberTap(e) {
    const id = e.currentTarget.dataset.id
    const userId = this.data.userId
    const member = (this.data.members || []).find((m) => m.id === id)
    if (!member) return
    if (member.id === userId || member._openid === userId) {
      this.openNickEdit()
    }
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
      content: '家人可用邀请码加入同一本账。',
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
    return '退出后你不能再看这本账。还有其他家庭成员在，账本会留下。'
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '只退出本机登录。云端家庭和记录还在，下次可再开通同步或加入。',
      confirmText: '退出登录',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '退出中' })
        try {
          await db.logout()
          wx.hideLoading()
          this.refresh()
          wx.showToast({ title: '已退出登录', icon: 'success' })
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: e.message || '退出失败', icon: 'none' })
        }
      }
    })
  },

  leaveFamily() {
    wx.showModal({
      title: '退出家庭',
      content: this.leaveConfirmContent(),
      confirmText: '退出家庭',
      confirmColor: '#B54A3A',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '退出中' })
        try {
          await db.leaveFamily()
          wx.hideLoading()
          this.refresh()
          wx.showToast({ title: '已退出家庭', icon: 'success' })
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
  },

  clearLocalBook() {
    wx.showModal({
      title: '清除本机账本',
      content: '只删除这台手机上的本地记录，不会影响云端。',
      confirmText: '清除',
      confirmColor: '#B54A3A',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '清除中' })
        try {
          await db.clearLocalBook()
          wx.hideLoading()
          this.refresh()
          wx.showToast({ title: '已清除', icon: 'success' })
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: e.message || '清除失败', icon: 'none' })
        }
      }
    })
  }
})
