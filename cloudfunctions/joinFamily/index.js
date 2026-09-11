const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const code = String(event.inviteCode || '').trim().toUpperCase()
  if (!code) throw new Error('请输入邀请码')

  const found = await db.collection('xiaoya_families').where({ inviteCode: code }).limit(1).get()
  if (!found.data.length) throw new Error('邀请码不对')
  const family = found.data[0]

  const mine = await db.collection('xiaoya_members').where({ _openid: OPENID }).get()
  const inTarget = mine.data.filter((m) => m.familyId === family._id)
  const others = mine.data.filter((m) => m.familyId !== family._id)

  for (let i = 0; i < others.length; i++) {
    await db.collection('xiaoya_members').doc(others[i]._id).remove()
  }

  if (!inTarget.length) {
    await db.collection('xiaoya_members').add({
      data: {
        _openid: OPENID,
        familyId: family._id,
        nickName: '家人',
        role: '家长',
        joinedAt: Date.now()
      }
    })
  }

  return { familyId: family._id, already: inTarget.length > 0 }
}
