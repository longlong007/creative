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

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const preferredFamilyId = String((event && event.familyId) || '').trim()

  const mine = await db.collection('xiaoya_members').where({ _openid: OPENID }).get()
  if (!mine.data.length) throw new Error('不在这个家里')

  let myMember = mine.data[0]
  if (preferredFamilyId) {
    myMember = mine.data.find((m) => m.familyId === preferredFamilyId) || myMember
  } else if (mine.data.length > 1) {
    myMember = mine.data.slice().sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))[0]
  }

  const familyId = myMember.familyId
  if (!familyId) throw new Error('不在这个家里')

  const [familyRes, membersRes] = await Promise.all([
    db.collection('xiaoya_families').doc(familyId).get(),
    db.collection('xiaoya_members').where({ familyId }).get()
  ])
  const family = familyRes.data
  const members = membersRes.data
  const decision = decideLeave({ openid: OPENID, members, family })

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
    try {
      await db.collection('xiaoya_users').doc(OPENID).update({
        data: { currentFamilyId: '', lastSeenAt: Date.now() }
      })
    } catch (e) {}
    return { ok: true, action: 'dissolve', familyId }
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
  try {
    await db.collection('xiaoya_users').doc(OPENID).update({
      data: { currentFamilyId: '', lastSeenAt: Date.now() }
    })
  } catch (e) {}
  return { ok: true, action: decision.action, familyId }
}

