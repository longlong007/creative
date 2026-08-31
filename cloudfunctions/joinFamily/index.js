const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const code = String(event.inviteCode || '').trim().toUpperCase()
  if (!code) throw new Error('请输入邀请码')

  const found = await db.collection('families').where({ inviteCode: code }).limit(1).get()
  if (!found.data.length) throw new Error('邀请码不对')
  const family = found.data[0]

  const already = await db.collection('members').where({ familyId: family._id }).get()
  if (already.data.some((m) => m._openid === OPENID)) {
    return { familyId: family._id, already: true }
  }

  await db.collection('members').add({
    data: {
      familyId: family._id,
      nickName: '家人',
      role: '家长',
      joinedAt: Date.now()
    }
  })

  return { familyId: family._id, already: false }
}
