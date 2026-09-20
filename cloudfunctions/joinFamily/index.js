const cloud = require('wx-server-sdk')
const { decideLeave } = require('./policy')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const PAGE = 20

async function removeAllWhere(db, collection, where) {
  for (;;) {
    const res = await db.collection(collection).where(where).limit(PAGE).get()
    if (!res.data.length) break
    await Promise.all(res.data.map((doc) => db.collection(collection).doc(doc._id).remove()))
  }
}

async function removeByIds(db, collection, ids) {
  const list = (ids || []).filter(Boolean)
  for (let i = 0; i < list.length; i += PAGE) {
    const chunk = list.slice(i, i + PAGE)
    await Promise.all(chunk.map((id) => db.collection(collection).doc(id).remove().catch(() => null)))
  }
}

async function leaveCurrentFamily(db, openid, familyId) {
  const [familyRes, membersRes] = await Promise.all([
    db.collection('xiaoya_families').doc(familyId).get(),
    db.collection('xiaoya_members').where({ familyId }).get()
  ])
  const family = familyRes.data
  const members = membersRes.data
  const decision = decideLeave({ openid, members, family })

  if (decision.action === 'dissolve') {
    const babiesRes = await db.collection('xiaoya_babies').where({ familyId }).get()
    const babyIds = babiesRes.data.map((b) => b._id)
    await removeAllWhere(db, 'xiaoya_records', { familyId })
    for (let i = 0; i < babyIds.length; i++) {
      await removeAllWhere(db, 'xiaoya_records', { babyId: babyIds[i] })
    }
    await removeByIds(db, 'xiaoya_babies', babyIds)
    await removeAllWhere(db, 'xiaoya_members', { familyId })
    await db.collection('xiaoya_families').doc(familyId).remove()
    return
  }

  if (decision.action === 'transfer') {
    const successor = decision.successor
    if (!successor || !successor._id) throw new Error('找不到交接人')
    await db.collection('xiaoya_members').doc(successor._id).update({
      data: { role: '创建者' }
    })
    await db.collection('xiaoya_families').doc(familyId).update({
      data: { createdBy: successor._openid }
    })
  }

  await db.collection('xiaoya_members').doc(decision.me._id).remove()
}

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const code = String(event.inviteCode || '').trim().toUpperCase()
  const confirmSwitch = Boolean(event.confirmSwitch)
  if (!code) throw new Error('请输入邀请码')

  const found = await db.collection('xiaoya_families').where({ inviteCode: code }).limit(1).get()
  if (!found.data.length) throw new Error('邀请码不对')
  const family = found.data[0]

  const mine = await db.collection('xiaoya_members').where({ _openid: OPENID }).get()
  const inTarget = mine.data.filter((m) => m.familyId === family._id)
  const others = mine.data.filter((m) => m.familyId !== family._id)

  if (others.length && !confirmSwitch) {
    let currentFamilyName = '当前家庭'
    try {
      const cur = await db.collection('xiaoya_families').doc(others[0].familyId).get()
      currentFamilyName = (cur.data && cur.data.name) || currentFamilyName
    } catch (e) {}
    return {
      needConfirm: true,
      currentFamilyName,
      targetFamilyName: family.name || '新家庭'
    }
  }

  for (let i = 0; i < others.length; i++) {
    await leaveCurrentFamily(db, OPENID, others[i].familyId)
  }

  if (!inTarget.length) {
    const nickName = String(event.nickName || '').trim() || '家人'
    await db.collection('xiaoya_members').add({
      data: {
        _openid: OPENID,
        familyId: family._id,
        nickName,
        role: '家长',
        joinedAt: Date.now()
      }
    })
  }

  const nickName = String(event.nickName || '').trim()
  const userPatch = {
    currentFamilyId: family._id,
    status: 'active',
    lastSeenAt: Date.now()
  }
  if (nickName) userPatch.nickName = nickName
  try {
    await db.collection('xiaoya_users').doc(OPENID).update({ data: userPatch })
  } catch (e) {
    await db.collection('xiaoya_users').doc(OPENID).set({
      data: Object.assign(
        {
          createdAt: Date.now()
        },
        userPatch
      )
    })
  }

  return { familyId: family._id, already: inTarget.length > 0 }
}
