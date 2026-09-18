const db = require('../../utils/db')
const format = require('../../utils/format')
const { leaveLoginFlow } = require('../../utils/guest')

Page({
  data: {
    step: 'hello',
    nickName: '',
    babyName: '',
    gender: 'girl',
    birthday: format.formatYmd(Date.now() - 90 * 86400000)
  },

  async onLoad() {
    await getApp().whenReady()
    if (db.hasBaby()) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  goCreate() {
    this.setData({ step: 'create' })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/join/join' })
  },

  skipLogin() {
    leaveLoginFlow()
  },

  backHello() {
    this.setData({ step: 'hello' })
  },

  onNick(e) {
    this.setData({ nickName: e.detail.value })
  },

  onName(e) {
    this.setData({ babyName: e.detail.value })
  },

  onGender(e) {
    this.setData({ gender: e.currentTarget.dataset.g })
  },

  onBirth(e) {
    this.setData({ birthday: e.detail.value })
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
    const name = (this.data.babyName || '').trim()
    if (!name) {
      wx.showToast({ title: '先写宝宝的名字', icon: 'none' })
      return
    }
    if (!this.data.birthday) {
      wx.showToast({ title: '选一个生日', icon: 'none' })
      return
    }
    wx.showLoading({ title: '创建中' })
    try {
      await db.createFamilyAndBaby({
        nickName,
        babyName: name,
        birthday: this.data.birthday,
        gender: this.data.gender
      })
      wx.hideLoading()
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '创建失败', icon: 'none' })
    }
  }
})
