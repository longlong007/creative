function leaveLoginFlow() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack()
    return
  }
  wx.switchTab({ url: '/pages/index/index' })
}

function promptCreateBaby() {
  wx.showModal({
    title: '先给宝宝建一本',
    content: '建好后就可以记喝奶、睡眠和尿布。也可以先看看页面。',
    confirmText: '去填写',
    cancelText: '暂不登录',
    success(res) {
      if (res.confirm) wx.navigateTo({ url: '/pages/onboarding/onboarding' })
    }
  })
}

function requireBaby(db) {
  if (db.hasBaby()) return true
  promptCreateBaby()
  return false
}

module.exports = {
  leaveLoginFlow,
  promptCreateBaby,
  requireBaby
}
