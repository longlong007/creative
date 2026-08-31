const db = require('./utils/db')

App({
  async onLaunch() {
    this.globalData = { ready: false }
    try {
      await db.init()
    } catch (e) {
      console.error('init failed', e)
    }
    this.globalData.ready = true
    if (this._readyWaiters) {
      this._readyWaiters.forEach((fn) => fn())
      this._readyWaiters = []
    }
  },

  whenReady() {
    if (this.globalData && this.globalData.ready) return Promise.resolve()
    return new Promise((resolve) => {
      this._readyWaiters = this._readyWaiters || []
      this._readyWaiters.push(resolve)
    })
  }
})
