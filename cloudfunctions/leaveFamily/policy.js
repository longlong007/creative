function memberId(m) {
  return (m && (m._id || m.id)) || ''
}

function isCreator(member, family, openid) {
  if (!member) return false
  if (member.role === '创建者') return true
  if (family && family.createdBy && family.createdBy === openid) return true
  return false
}

function pickSuccessor(others) {
  return others
    .slice()
    .sort((a, b) => {
      const ja = a.joinedAt || 0
      const jb = b.joinedAt || 0
      if (ja !== jb) return ja - jb
      return String(memberId(a)).localeCompare(String(memberId(b)))
    })[0]
}

function decideLeave({ openid, members, family }) {
  const list = Array.isArray(members) ? members : []
  const me = list.find((m) => m && m._openid === openid)
  if (!me) throw new Error('不在这个家里')

  const others = list.filter((m) => m && m._openid !== openid)
  if (!others.length) {
    return { action: 'dissolve', successor: null, me }
  }

  if (isCreator(me, family, openid)) {
    return { action: 'transfer', successor: pickSuccessor(others), me }
  }

  return { action: 'leave', successor: null, me }
}

module.exports = {
  decideLeave,
  pickSuccessor,
  isCreator
}
