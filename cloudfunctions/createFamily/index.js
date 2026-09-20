const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(length) {
  const n = length || 6
  let s = ''
  for (let i = 0; i < n; i++) {
    s += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length))
  }
  return s
}

async function ensureUniqueInviteCode(db, preferred) {
  let code = String(preferred || '').trim().toUpperCase()
  for (let i = 0; i < 12; i++) {
    if (!code) code = randomCode(6)
    const found = await db.collection('xiaoya_families').where({ inviteCode: code }).limit(1).get()
    if (!found.data.length) return code
    code = randomCode(6)
  }
  throw new Error('邀请码生成失败，请稍后重试')
}

exports.main = async (event) => {
  const db = cloud.database()
  const { OPENID } = cloud.getWXContext()
  const familyName = event.familyName || '我家'
  const baby = event.baby || {}
  const nickName = String(event.nickName || '').trim() || '我'

  const existed = await db.collection('xiaoya_members').where({ _openid: OPENID }).count()
  if (existed.total > 0) {
    throw new Error('已经在一个家庭里了')
  }

  const inviteCode = await ensureUniqueInviteCode(db, event.inviteCode)
  const now = Date.now()

  const fam = await db.collection('xiaoya_families').add({
    data: {
      _openid: OPENID,
      name: familyName,
      inviteCode,
      createdAt: now,
      createdBy: OPENID
    }
  })

  await db.collection('xiaoya_members').add({
    data: {
      _openid: OPENID,
      familyId: fam._id,
      nickName,
      role: '创建者',
      joinedAt: now
    }
  })

  await db.collection('xiaoya_babies').add({
    data: {
      _openid: OPENID,
      familyId: fam._id,
      name: baby.name,
      birthday: baby.birthday,
      gender: baby.gender || 'unknown',
      avatar: '',
      createdAt: now
    }
  })

  try {
    await db.collection('xiaoya_users').doc(OPENID).set({
      data: {
        nickName,
        currentFamilyId: fam._id,
        status: 'active',
        createdAt: now,
        lastSeenAt: now
      }
    })
  } catch (e) {
    await db.collection('xiaoya_users').doc(OPENID).update({
      data: {
        nickName,
        currentFamilyId: fam._id,
        status: 'active',
        lastSeenAt: now
      }
    })
  }

  return { familyId: fam._id, inviteCode }
}
