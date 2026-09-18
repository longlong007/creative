const db = require('../../utils/db')
const stats = require('../../utils/stats')
const format = require('../../utils/format')
const { hideTabBar, showTabBar } = require('../../utils/tab')

function niceStep(raw) {
  if (!(raw > 0)) return 1
  const exp = Math.floor(Math.log10(raw))
  const f = raw / Math.pow(10, exp)
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nf * Math.pow(10, exp)
}

function niceAxis(min, max, count) {
  const span = max - min || 1
  const step = niceStep(span / Math.max(count - 1, 1))
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const n = Math.round((niceMax - niceMin) / step)
  const ticks = []
  for (let i = 0; i <= n; i++) ticks.push(Number((niceMin + i * step).toFixed(10)))
  return { min: niceMin, max: niceMax, ticks, step }
}

function formatTick(v, step) {
  if (step >= 1) return String(Math.round(v))
  if (step >= 0.1) return v.toFixed(1)
  return v.toFixed(2)
}

function axisDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function pickIndexes(n, maxLabels) {
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i)
  const out = []
  for (let k = 0; k < maxLabels; k++) {
    out.push(Math.round((k * (n - 1)) / (maxLabels - 1)))
  }
  return out.filter((v, i, arr) => !i || v !== arr[i - 1])
}

Page({
  data: {
    tab: 'weight',
    height: null,
    weight: null,
    heightText: '还没量',
    weightText: '还没量',
    series: [],
    pressedId: '',
    sheet: false,
    formType: 'weight',
    formValue: '',
    formDate: '',
    formTime: ''
  },

  async onShow() {
    showTabBar(this, 2)
    await getApp().whenReady()
    if (!db.hasBaby()) {
      wx.redirectTo({ url: '/pages/onboarding/onboarding' })
      return
    }
    this.bindDb()
    await db.syncRecords()
    this.refresh()
  },

  onHide() {
    this.unbindDb()
  },

  onUnload() {
    this.unbindDb()
  },

  bindDb() {
    this.unbindDb()
    this._unbindDb = db.onChange(() => this.refresh())
  },

  unbindDb() {
    if (this._unbindDb) {
      this._unbindDb()
      this._unbindDb = null
    }
  },

  refresh() {
    const records = db.snapshot().records
    const latest = stats.latestGrowth(records)
    const tab = this.data.tab
    const series = stats.growthSeries(records, tab).reverse()
    this.setData({
      height: latest.height,
      weight: latest.weight,
      heightText: latest.height ? `${latest.height.amount} cm` : '还没量',
      weightText: latest.weight ? `${latest.weight.amount} kg` : '还没量',
      heightWhen: latest.height ? format.formatDate(latest.height.startAt) : '',
      weightWhen: latest.weight ? format.formatDate(latest.weight.startAt) : '',
      series: series.map((p) => ({
        id: p.id,
        v: p.v,
        t: p.t,
        tText: format.formatDate(p.t)
      }))
    })
    wx.nextTick(() => this.draw())
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
    this.refresh()
  },

  openAdd(e) {
    const type = e.currentTarget.dataset.type || this.data.tab
    const parts = format.nowDateTime()
    hideTabBar(this)
    this.setData({
      sheet: true,
      formType: type,
      formValue: '',
      formDate: parts.date,
      formTime: parts.time
    })
  },

  onDate(e) {
    this.setData({ formDate: e.detail.value })
  },

  onTime(e) {
    this.setData({ formTime: e.detail.value })
  },

  closeSheet() {
    showTabBar(this, 2)
    this.setData({ sheet: false })
  },

  onValue(e) {
    this.setData({ formValue: e.detail.value })
  },

  async save() {
    if (this._saving) return
    const v = Number(this.data.formValue)
    if (!v) {
      wx.showToast({ title: '填一个数字', icon: 'none' })
      return
    }
    this._saving = true
    const type = this.data.formType
    try {
      await db.addRecord({
        type,
        amount: v,
        unit: type === 'height' ? 'cm' : 'kg',
        startAt: format.toTs(this.data.formDate, this.data.formTime),
        source: 'manual'
      })
      showTabBar(this, 2)
      this.setData({ sheet: false })
      wx.showToast({ title: '记下了', icon: 'success' })
      this.refresh()
    } finally {
      this._saving = false
    }
  },

  onRowTouchStart(e) {
    this.setData({ pressedId: e.currentTarget.dataset.id })
  },

  onRowTouchEnd() {
    if (this._pressTimer) clearTimeout(this._pressTimer)
    this._pressTimer = setTimeout(() => this.setData({ pressedId: '' }), 180)
  },

  editRecord(e) {
    if (this._opening) return
    this._opening = true
    const id = e.currentTarget.dataset.id
    this.setData({ pressedId: id })
    setTimeout(() => {
      this._opening = false
      wx.navigateTo({ url: `/pages/record-edit/record-edit?id=${id}` })
    }, 140)
  },

  draw() {
    const series = stats.growthSeries(db.snapshot().records, this.data.tab)
    const query = wx.createSelectorQuery()
    query
      .select('#chart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 1
        const w = res[0].width
        const h = res[0].height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, w, h)
        if (series.length < 1) {
          ctx.fillStyle = '#8A8178'
          ctx.font = '12px sans-serif'
          ctx.fillText('量两次就能看到曲线', 16, h / 2)
          return
        }
        const pad = { l: 44, r: 16, t: 28, b: 38 }
        const values = series.map((p) => p.v)
        let min = Math.min.apply(null, values)
        let max = Math.max.apply(null, values)
        if (min === max) {
          min -= 1
          max += 1
        }
        const axis = niceAxis(min, max, 4)
        min = axis.min
        max = axis.max
        const innerW = w - pad.l - pad.r
        const innerH = h - pad.t - pad.b
        const xAt = (i) => pad.l + (series.length === 1 ? innerW / 2 : (i * innerW) / (series.length - 1))
        const yAt = (v) => pad.t + ((max - v) / (max - min)) * innerH
        const yUnit = this.data.tab === 'weight' ? 'kg' : 'cm'

        ctx.strokeStyle = '#F0E8DE'
        ctx.lineWidth = 1
        axis.ticks.forEach((tick) => {
          const y = yAt(tick)
          ctx.beginPath()
          ctx.moveTo(pad.l, y)
          ctx.lineTo(w - pad.r, y)
          ctx.stroke()
        })

        ctx.strokeStyle = '#EDE4D8'
        ctx.beginPath()
        ctx.moveTo(pad.l, pad.t)
        ctx.lineTo(pad.l, h - pad.b)
        ctx.lineTo(w - pad.r, h - pad.b)
        ctx.stroke()

        ctx.fillStyle = '#8A8178'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(yUnit, pad.l - 6, pad.t - 6)
        ctx.textBaseline = 'middle'
        axis.ticks.forEach((tick) => {
          ctx.fillText(formatTick(tick, axis.step), pad.l - 6, yAt(tick))
        })

        const xLabels = pickIndexes(series.length, 4)
        ctx.textBaseline = 'top'
        xLabels.forEach((i, idx) => {
          const x = xAt(i)
          ctx.textAlign = idx === 0 ? 'left' : idx === xLabels.length - 1 ? 'right' : 'center'
          ctx.fillText(axisDate(series[i].t), x, h - pad.b + 6)
        })
        ctx.textAlign = 'right'
        ctx.fillText('日期', w - pad.r, h - 12)

        ctx.strokeStyle = this.data.tab === 'weight' ? '#E07A5F' : '#6A9E8A'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        series.forEach((p, i) => {
          const x = xAt(i)
          const y = yAt(p.v)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()

        series.forEach((p, i) => {
          const x = xAt(i)
          const y = yAt(p.v)
          ctx.fillStyle = this.data.tab === 'weight' ? '#E07A5F' : '#6A9E8A'
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
        })
      })
  },

  noop() {}
})
