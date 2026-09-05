const db = require('../../utils/db')
const present = require('../../utils/present')
const format = require('../../utils/format')
const { hideTabBar, showTabBar } = require('../../utils/tab')
const { MILK_SUBTYPES, MILK_AMOUNTS, BREAST_MINUTES, TIME_OFFSETS, MORE_ACTIONS, DIAPER_SUBTYPES, FORM_TITLES } = require('../../utils/constants')

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
    formDate: '',
    formTime: '',
    moreActions: MORE_ACTIONS,
    diaperSubtypes: DIAPER_SUBTYPES,
    formTitle: '',
    moreForm: { type: '', value: '', note: '', date: '', time: '', subtype: '' }
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

  nowParts() {
    return format.nowDateTime()
  },

  openMilk(e) {
    const last = this.data.lastAmount || 120
    const subtype = this.data.milkSubtype
    const meta = MILK_SUBTYPES.find((s) => s.key === subtype) || MILK_SUBTYPES[0]
    const parts = this.nowParts()
    const backfill = !!(e && e.currentTarget && e.currentTarget.dataset.backfill)
    hideTabBar(this)
    this.setData({
      sheet: 'milk',
      milkAmount: last,
      isBreast: meta.type === 'breastfeed',
      timeOffset: backfill ? 'custom' : 'now',
      formDate: parts.date,
      formTime: parts.time
    })
  },

  openSleepBackfill() {
    wx.navigateTo({ url: '/pages/record-edit/record-edit?type=sleep' })
  },

  openDiaperBackfill(e) {
    this.openForm('diaper', e.currentTarget.dataset.key)
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
    const key = e.currentTarget.dataset.key
    const patch = { timeOffset: key }
    if (key === 'custom') {
      const parts = this.nowParts()
      patch.formDate = this.data.formDate || parts.date
      patch.formTime = this.data.formTime || parts.time
    }
    this.setData(patch)
  },

  onMilkDate(e) {
    this.setData({ formDate: e.detail.value })
  },

  onMilkTime(e) {
    this.setData({ formTime: e.detail.value })
  },

  onAmountInput(e) {
    this.setData({ milkAmount: Number(e.detail.value) || 0 })
  },

  resolveTime() {
    if (this.data.timeOffset === 'custom') {
      return format.toTs(this.data.formDate, this.data.formTime)
    }
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
    this.openForm(e.currentTarget.dataset.type)
  },

  openForm(type, subtype) {
    hideTabBar(this)
    const parts = this.nowParts()
    this.setData({
      sheet: 'form',
      formTitle: FORM_TITLES[type] || '记一笔',
      moreForm: {
        type,
        value: '',
        note: '',
        date: parts.date,
        time: parts.time,
        subtype: subtype || (type === 'diaper' ? 'pee' : '')
      }
    })
  },

  onFormValue(e) {
    this.setData({ 'moreForm.value': e.detail.value })
  },

  onFormNote(e) {
    this.setData({ 'moreForm.note': e.detail.value })
  },

  onFormDate(e) {
    this.setData({ 'moreForm.date': e.detail.value })
  },

  onFormTime(e) {
    this.setData({ 'moreForm.time': e.detail.value })
  },

  chooseDiaperSubtype(e) {
    this.setData({ 'moreForm.subtype': e.currentTarget.dataset.key })
  },

  async saveMore() {
    const form = this.data.moreForm
    const type = form.type
    const payload = {
      type,
      source: 'manual',
      startAt: format.toTs(form.date, form.time),
      note: form.note
    }
    if (type === 'height') {
      payload.amount = Number(form.value)
      payload.unit = 'cm'
    } else if (type === 'weight') {
      payload.amount = Number(form.value)
      payload.unit = 'kg'
    } else if (type === 'temperature') {
      payload.amount = Number(form.value)
      payload.unit = '°C'
    } else if (type === 'diaper') {
      payload.subtype = form.subtype || 'pee'
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
