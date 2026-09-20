const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

async function assertMember(db, openid, familyId) {
  if (!familyId) throw new Error('无权操作这个家庭')
  const members = await db
    .collection('xiaoya_members')
    .where({
      _openid: openid,
      familyId
    })
    .limit(1)
    .get()
  if (!members.data.length) throw new Error('无权操作这个家庭')
  return members.data[0]
}

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const action = event && event.action
  const familyId = event && event.familyId
  const member = await assertMember(db, OPENID, familyId)

  if (action === 'updateNickName') {
    const nickName = String((event && event.nickName) || '').trim()
    if (!nickName) throw new Error('先写你的昵称')
    if (nickName === '匿名用户') throw new Error('请换一个昵称')
    if (nickName.length > 12) throw new Error('昵称最多 12 个字')
    await db.collection('xiaoya_members').doc(member._id).update({
      data: { nickName }
    })
    try {
      await db.collection('xiaoya_users').doc(OPENID).update({
        data: { nickName, lastSeenAt: Date.now() }
      })
    } catch (e) {}
    return { ok: true, nickName }
  }

  if (action === 'addBaby') {
    const baby = (event && event.baby) || {}
    const data = {
      _openid: OPENID,
      familyId,
      name: String(baby.name || '').trim(),
      birthday: baby.birthday,
      gender: baby.gender || 'unknown',
      avatar: baby.avatar || '',
      createdAt: Date.now()
    }
    if (!data.name) throw new Error('先写宝宝名字')
    const res = await db.collection('xiaoya_babies').add({ data })
    return { ok: true, id: res._id }
  }

  if (action === 'updateBaby') {
    const id = event && event.id
    const patch = Object.assign({}, (event && event.patch) || {})
    delete patch._id
    delete patch.id
    delete patch.familyId
    delete patch._openid
    if (!id) throw new Error('缺少宝宝')
    const baby = (await db.collection('xiaoya_babies').doc(id).get()).data
    if (!baby || baby.familyId !== familyId) throw new Error('无权改这个宝宝')
    await db.collection('xiaoya_babies').doc(id).update({ data: patch })
    return { ok: true }
  }

  if (action === 'updateSolidFoods') {
    const solidFoods = Array.isArray(event.solidFoods) ? event.solidFoods : []
    await db.collection('xiaoya_families').doc(familyId).update({
      data: { solidFoods }
    })
    return { ok: true, solidFoods }
  }

  throw new Error('未知操作')
}
