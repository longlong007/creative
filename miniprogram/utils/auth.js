const SESSION_KEY = 'xiaoya_session'
const FAMILY_KEY = 'xiaoya_current_family'
const BABY_KEY = 'xiaoya_current_baby'

function canUseStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync
}

function readSession() {
  if (!canUseStorage()) return null
  try {
    const raw = wx.getStorageSync(SESSION_KEY)
    if (!raw) return null
    const session = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!session || !session.openid) return null
    return session
  } catch (e) {
    return null
  }
}

function writeSession(session) {
  if (!canUseStorage() || !session || !session.openid) return
  const next = {
    openid: session.openid,
    familyId: session.familyId || '',
    nickName: session.nickName || '',
    role: session.role || '家长',
    loggedInAt: session.loggedInAt || Date.now()
  }
  wx.setStorageSync(SESSION_KEY, next)
  if (next.familyId) wx.setStorageSync(FAMILY_KEY, next.familyId)
}

function clearSession() {
  if (!canUseStorage()) return
  try {
    wx.removeStorageSync(SESSION_KEY)
  } catch (e) {}
  try {
    wx.removeStorageSync(FAMILY_KEY)
  } catch (e) {}
  try {
    wx.removeStorageSync(BABY_KEY)
  } catch (e) {}
}

function authStatus(mode, hasBaby) {
  if (mode === 'cloud') return 'cloud'
  if (hasBaby) return 'local'
  return 'guest'
}

module.exports = {
  SESSION_KEY,
  FAMILY_KEY,
  BABY_KEY,
  readSession,
  writeSession,
  clearSession,
  authStatus
}
