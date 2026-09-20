const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  if (!OPENID) throw new Error('无法识别微信身份')

  if (event && event.action === 'logout') {
    try {
      await db.collection('xiaoya_users').doc(OPENID).update({
        data: { currentFamilyId: '', lastSeenAt: Date.now() }
      })
    } catch (e) {}
    return { ok: true, openid: OPENID }
  }

  const now = Date.now()
  const userRef = db.collection('xiaoya_users').doc(OPENID)
  let user = null
  try {
    user = (await userRef.get()).data || null
  } catch (e) {
    user = null
  }

  if (!user) {
    user = {
      nickName: '',
      currentFamilyId: '',
      status: 'active',
      createdAt: now,
      lastSeenAt: now
    }
    await userRef.set({ data: user })
  } else {
    await userRef.update({ data: { lastSeenAt: now } })
    user.lastSeenAt = now
  }

  if (user.status && user.status !== 'active') {
    return {
      openid: OPENID,
      appid: APPID,
      unionid: UNIONID,
      user: {
        openid: OPENID,
        nickName: user.nickName || '',
        currentFamilyId: '',
        status: user.status
      },
      membership: null
    }
  }

  const members = await db
    .collection('xiaoya_members')
    .where({ _openid: OPENID })
    .limit(5)
    .get()
  const membership = members.data[0] || null

  if (membership && user.currentFamilyId !== membership.familyId) {
    await userRef.update({ data: { currentFamilyId: membership.familyId } })
    user.currentFamilyId = membership.familyId
  }

  if (!membership && user.currentFamilyId) {
    await userRef.update({ data: { currentFamilyId: '' } })
    user.currentFamilyId = ''
  }

  return {
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID,
    user: {
      openid: OPENID,
      nickName: user.nickName || (membership && membership.nickName) || '',
      currentFamilyId: user.currentFamilyId || '',
      status: user.status || 'active'
    },
    membership: membership
      ? {
          familyId: membership.familyId,
          nickName: membership.nickName,
          role: membership.role
        }
      : null
  }
}
