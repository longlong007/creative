const db = require('../../utils/db')
const present = require('../../utils/present')
const { hideTabBar, showTabBar } = require('../../utils/tab')
const { MILK_SUBTYPES, MILK_AMOUNTS, BREAST_MINUTES, TIME_OFFSETS, MORE_ACTIONS } = require('../../utils/constants')

Page({
  data: {
    baby: null,
    ageText: '',
    todayMilk: '—',
    todaySleep: '—',
    todayDiaper: '—',
    lastMilkAgo: '',
    lastMilkTitle: '',
    lastAmount: 120,
    activeSleep: null,
    activeSleepText: '',
    recent: [],
    sheet: '',
    milkSubtypes: MILK_SUBTYPES,
    milkSubtype: 'formula',
    milkAmount: 120,
    milkAmounts: MILK_AMOUNTS,
    breastMinutes: BREAST_MINUTES,
    isBreast: false,
    timeOffsets: TIME_OFFSETS,
    timeOffset: 'now',
    moreActions: MORE_ACTIONS,
    moreForm: { type: '', value: '', note: '', start: '', end: '' }
  },

  async onShow() {
    showTabBar(this, 0)
    await getApp().whenReady()
    if (!db.hasBaby()) {
      wx.redirectTo({ url: '/pages/onboarding/onboarding' })
      return
    }
    this.refresh()
    this.startTick()
  },

  onHide() {
    this.stopTick()
  },

  onUnload() {
    this.stopTick()
  },

  startTick() {
    this.stopTick()
    this._tick = setInterval(() => {
      if (this.data.activeSleep) this.refresh()
    }, 1000)
  },

  stopTick() {
    if (this._tick) {
      clearInterval(this._tick)
      this._tick = null
    }
  },

  refresh() {
    this.setData(present.presentHome(db.snapshot()))
  },

  goInsights() {
    wx.navigateTo({ url: '/pages/insights/insights' })
  },

  goFamily() {
    wx.switchTab({ url: '/pages/family/family' })
  },

  openMilk() {
    const last = this.data.lastAmount || 120
    const subtype = this.data.milkSubtype
    const meta = MILK_SUBTYPES.find((s) => s.key === subtype) || MILK_SUBTYPES[0]
    hideTabBar(this)
    this.setData({
      sheet: 'milk',
      milkAmount: last,
      isBreast: meta.type === 'breastfeed',
      timeOffset: 'now'
    })
  },

  closeSheet() {
    showTabBar(this, 0)
    this.setData({ sheet: '' })
  },

  chooseSubtype(e) {
    const key = e.currentTarget.dataset.key
    const meta = MILK_SUBTYPES.find((s) => s.key === key)
    this.setData({
      milkSubtype: key,
      isBreast: meta.type === 'breastfeed',
      milkAmount: meta.type === 'breastfeed' ? 10 : this.data.lastAmount || 120
    })
  },

  chooseAmount(e) {
    this.setData({ milkAmount: Number(e.currentTarget.dataset.v) })
  },

  chooseTime(e) {
    this.setData({ timeOffset: e.currentTarget.dataset.key })
  },

  onAmountInput(e) {
    this.setData({ milkAmount: Number(e.detail.value) || 0 })
  },

  resolveTime() {
    const item = TIME_OFFSETS.find((t) => t.key === this.data.timeOffset) || TIME_OFFSETS[0]
    return Date.now() + item.minutes * 60000
  },

  async saveMilk() {
    const meta = MILK_SUBTYPES.find((s) => s.key === this.data.milkSubtype)
    const startAt = this.resolveTime()
    wx.vibrateShort({ type: 'light' })
    if (meta.type === 'breastfeed') {
      await db.addRecord({
        type: 'breastfeed',
        subtype: meta.key,
        durationMin: this.data.milkAmount,
        amount: this.data.milkAmount,
        unit: '分钟',
        startAt,
        source: 'quick'
      })
    } else {
      await db.addRecord({
        type: 'milk',
        subtype: meta.key,
        amount: this.data.milkAmount,
        unit: 'ml',
        startAt,
        source: 'quick'
      })
    }
    showTabBar(this, 0)
    this.setData({ sheet: '' })
    wx.showToast({ title: '记下了', icon: 'success' })
    this.refresh()
  },

  async toggleSleep() {
    wx.vibrateShort({ type: 'light' })
    if (this.data.activeSleep) {
      await db.endSleep()
      wx.showToast({ title: '醒来了', icon: 'success' })
    } else {
      await db.startSleep()
      wx.showToast({ title: '开始睡觉', icon: 'success' })
    }
    this.refresh()
  },

  async saveDiaper(e) {
    const key = e.currentTarget.dataset.key
    wx.vibrateShort({ type: 'light' })
    await db.addRecord({ type: 'diaper', subtype: key, startAt: Date.now(), source: 'quick' })
    wx.showToast({ title: '记下了', icon: 'success' })
    this.refresh()
  },

  openMore() {
    hideTabBar(this)
    this.setData({ sheet: 'more' })
  },

  openMoreForm(e) {
    const type = e.currentTarget.dataset.type
    hideTabBar(this)
    this.setData({
      sheet: 'form',
      moreForm: { type, value: '', note: '', start: '', end: '' }
    })
  },

  onFormValue(e) {
    this.setData({ 'moreForm.value': e.detail.value })
  },

  onFormNote(e) {
    this.setData({ 'moreForm.note': e.detail.value })
  },

  async saveMore() {
    const form = this.data.moreForm
    const type = form.type
    const payload = { type, source: 'manual', startAt: Date.now(), note: form.note }
    if (type === 'height') {
      payload.amount = Number(form.value)
      payload.unit = 'cm'
    } else if (type === 'weight') {
      payload.amount = Number(form.value)
      payload.unit = 'kg'
    } else if (type === 'temperature') {
      payload.amount = Number(form.value)
      payload.unit = '°C'
    } else if (type === 'sleep') {
      wx.navigateTo({ url: '/pages/record-edit/record-edit?type=sleep' })
      showTabBar(this, 0)
      this.setData({ sheet: '' })
      return
    }
    if ((type === 'height' || type === 'weight' || type === 'temperature') && !payload.amount) {
      wx.showToast({ title: '填一个数字', icon: 'none' })
      return
    }
    wx.vibrateShort({ type: 'light' })
    await db.addRecord(payload)
    showTabBar(this, 0)
    this.setData({ sheet: '' })
    wx.showToast({ title: '记下了', icon: 'success' })
    this.refresh()
  },

  editRecord(e) {
    const id = e.detail.id
    wx.navigateTo({ url: `/pages/record-edit/record-edit?id=${id}` })
  },

  noop() {}
})
