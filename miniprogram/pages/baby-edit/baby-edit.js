const db = require('../../utils/db')
const format = require('../../utils/format')

Page({
  data: {
    id: '',
    name: '',
    gender: 'girl',
    birthday: format.formatYmd(Date.now()),
    isNew: true
  },

  async onLoad(query) {
    await getApp().whenReady()
    if (!query.id) return
    const baby = db.snapshot().babies.find((b) => b.id === query.id)
    if (!baby) return
    this.setData({
      id: baby.id,
      name: baby.name,
      gender: baby.gender || 'unknown',
      birthday: baby.birthday,
      isNew: false
    })
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },

  onGender(e) {
    this.setData({ gender: e.currentTarget.dataset.g })
  },

  onBirth(e) {
    this.setData({ birthday: e.detail.value })
  },

  async save() {
    const name = (this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '写个名字', icon: 'none' })
      return
    }
    if (this.data.isNew) {
      await db.addBaby({ name, birthday: this.data.birthday, gender: this.data.gender })
    } else {
      await db.updateBaby(this.data.id, { name, birthday: this.data.birthday, gender: this.data.gender })
    }
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 400)
  }
})
