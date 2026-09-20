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

  async doJoin(confirmSwitch) {
    const nickName = (this.data.nickName || '').trim()
    return db.joinFamily(this.data.code, nickName, { confirmSwitch: Boolean(confirmSwitch) })
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

    const snap = db.snapshot()
    if (snap.authStatus === 'local' && snap.family) {
      const go = await new Promise((resolve) => {
        wx.showModal({
          title: '本机账本不会带走',
          content: '加入云端家庭后，这台手机上的本机记录不会自动上传到新家庭。',
          confirmText: '继续加入',
          cancelText: '取消',
          success: (res) => resolve(Boolean(res.confirm))
        })
      })
      if (!go) return
    }

    wx.showLoading({ title: '加入中' })
    try {
      await this.doJoin(false)
      wx.hideLoading()
      wx.showToast({ title: '已加入这本账', icon: 'success' })
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      if (e && e.code === 'NEED_CONFIRM') {
        wx.showModal({
          title: '要换家庭吗？',
          content: `你已在「${e.currentFamilyName}」。加入「${e.targetFamilyName}」会先退出旧家庭（一人只能在一个家庭）。`,
          confirmText: '确认切换',
          cancelText: '取消',
          success: async (res) => {
            if (!res.confirm) return
            wx.showLoading({ title: '切换中' })
            try {
              await this.doJoin(true)
              wx.hideLoading()
              wx.showToast({ title: '已加入新家庭', icon: 'success' })
              wx.switchTab({ url: '/pages/index/index' })
            } catch (err) {
              wx.hideLoading()
              wx.showModal({
                title: '还加不进去',
                content: err.message || '请检查邀请码',
                confirmText: '知道了',
                cancelText: '返回',
                success: (r) => {
                  if (r.cancel) this.skipJoin()
                }
              })
            }
          }
        })
        return
      }
      wx.showModal({
        title: '还加不进去',
        content: e.message || '请检查邀请码',
        confirmText: '知道了',
        cancelText: '返回',
        success: (res) => {
          if (res.cancel) this.skipJoin()
        }
      })
    }
  }
})
