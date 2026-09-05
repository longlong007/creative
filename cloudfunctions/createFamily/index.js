const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const familyName = event.familyName || '我家'
  const inviteCode = String(event.inviteCode || '').toUpperCase()
  const baby = event.baby || {}

  const existed = await db.collection('xiaoya_members').where({ _openid: OPENID }).count()
  if (existed.total > 0) {
    throw new Error('已经在一个家庭里了')
  }

  const fam = await db.collection('xiaoya_families').add({
    data: {
      name: familyName,
      inviteCode,
      createdAt: Date.now(),
      createdBy: OPENID
    }
  })

  await db.collection('xiaoya_members').add({
    data: {
      familyId: fam._id,
      nickName: '我',
      role: '创建者',
      joinedAt: Date.now()
    }
  })

  await db.collection('xiaoya_babies').add({
    data: {
      familyId: fam._id,
      name: baby.name,
      birthday: baby.birthday,
      gender: baby.gender || 'unknown',
      avatar: '',
      createdAt: Date.now()
    }
  })

  return { familyId: fam._id, inviteCode }
}
