const db = require('../../utils/db')
const format = require('../../utils/format')

Page({
  data: {
    step: 'hello',
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
