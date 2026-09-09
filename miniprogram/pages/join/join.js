const db = require('../../utils/db')

Page({
  data: { code: '' },

  onCode(e) {
    this.setData({ code: (e.detail.value || '').toUpperCase() })
  },

  async submit() {
    if (!this.data.code) {
      wx.showToast({ title: '填 6 位邀请码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '加入中' })
    try {
      await db.joinFamily(this.data.code)
      wx.hideLoading()
      wx.showToast({ title: '已加入这本账', icon: 'success' })
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      wx.showModal({
        title: '还加不进去',
        content: e.message || '请检查邀请码，或先配置云开发后再跨设备共享。',
        showCancel: false
      })
    }
  }
})
