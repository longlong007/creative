function uid(prefix) {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${rand}`
}

function inviteCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const n = length || 6
  let s = ''
  for (let i = 0; i < n; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return s
}

module.exports = { uid, inviteCode }
