const db = require('../../utils/db')
const { leaveLoginFlow } = require('../../utils/guest')

Page({
  data: { code: '', nickName: '' },

  onNick(e) {
    this.setData({ nickName: e.detail.value })
  },

  onCode(e) {
    this.setData({ code: (e.detail.value || '').toUpperCase() })
  },

  skipJoin() {
    leaveLoginFlow()
  },

  async submit() {
    const nickName = (this.data.nickName || '').trim()
    if (!nickName) {
      wx.showToast({ title: '先写你的昵称', icon: 'none' })
      return
    }
    if (nickName === '匿名用户') {
      wx.showToast({ title: '请换一个昵称', icon: 'none' })
      return
    }
    if (!this.data.code) {
      wx.showToast({ title: '填 6 位邀请码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '加入中' })
    try {
      await db.joinFamily(this.data.code, nickName)
      wx.hideLoading()
      wx.showToast({ title: '已加入这本账', icon: 'success' })
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      wx.showModal({
        title: '还加不进去',
        content: e.message || '请检查邀请码，或先在本机记录。',
        confirmText: '知道了',
        cancelText: '返回',
        success: (res) => {
          if (res.cancel) this.skipJoin()
        }
      })
    }
  }
})
