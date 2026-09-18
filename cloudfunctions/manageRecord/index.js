const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

async function familyIdOf(db, rec) {
  if (rec.familyId) return rec.familyId
  if (!rec.babyId) return ''
  try {
    const baby = await db.collection('xiaoya_babies').doc(rec.babyId).get()
    return (baby.data && baby.data.familyId) || ''
  } catch (e) {
    return ''
  }
}

async function assertMember(db, openid, familyId) {
  if (!familyId) throw new Error('无权改这条记录')
  const members = await db.collection('xiaoya_members').where({
    _openid: openid,
    familyId
  }).limit(1).get()
  if (!members.data.length) throw new Error('无权改这条记录')
}

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const action = event && event.action
  const id = event && event.id
  if (!id) throw new Error('缺少记录')

  let rec
  try {
    rec = (await db.collection('xiaoya_records').doc(id).get()).data
  } catch (e) {
    if (action === 'remove') return { ok: true, missing: true }
    throw new Error('找不到这条')
  }
  if (!rec) {
    if (action === 'remove') return { ok: true, missing: true }
    throw new Error('找不到这条')
  }

  const familyId = await familyIdOf(db, rec)
  await assertMember(db, OPENID, familyId)

  if (action === 'remove') {
    await db.collection('xiaoya_records').doc(id).remove()
    return { ok: true }
  }

  if (action === 'update') {
    const patch = event.patch || {}
    delete patch._id
    delete patch.id
    await db.collection('xiaoya_records').doc(id).update({ data: patch })
    return { ok: true }
  }

  throw new Error('未知操作')
}
