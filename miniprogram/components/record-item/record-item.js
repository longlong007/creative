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
    open: false
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
    onTap() {
      this.triggerEvent('edit', { id: this.data.record.id })
    }
  }
})
