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
    title: '给宝宝建一本',
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
