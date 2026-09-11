const stats = require('../../utils/stats')

Component({
  properties: {
    record: { type: Object, value: {} },
    showActor: { type: Boolean, value: true }
  },
  data: {
    title: '',
    time: '',
    color: '#8A8178',
    bg: '#EEEAE4',
    actor: '',
    open: false,
    pressed: false
  },
  observers: {
    record(rec) {
      if (!rec || !rec.type) return
      const meta = stats.typeMeta(rec.type)
      this.setData({
        title: stats.recordTitle(rec),
        time: stats.recordTimeLabel(rec),
        color: meta.color,
        bg: meta.bg,
        actor: rec.createdByName || '',
        open: rec.type === 'sleep' && !rec.endAt
      })
    }
  },
  methods: {
    onTouchStart() {
      this.setData({ pressed: true })
    },

    onTouchEnd() {
      this.releasePress()
    },

    onTouchCancel() {
      this.releasePress()
    },

    releasePress() {
      if (this._pressTimer) clearTimeout(this._pressTimer)
      this._pressTimer = setTimeout(() => this.setData({ pressed: false }), 180)
    },

    onTap() {
      if (this._opening) return
      this._opening = true
      this.setData({ pressed: true })
      const id = this.data.record.id
      setTimeout(() => {
        this._opening = false
        this.triggerEvent('edit', { id })
      }, 140)
    }
  }
})
