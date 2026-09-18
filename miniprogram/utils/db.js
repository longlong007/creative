const config = require('../config')
const { uid, inviteCode } = require('./id')
const { SOLID_FOODS, mergeSolidFoods } = require('./constants')

const STORAGE_KEY = 'xiaoya_db_v1'

function emptyState() {
  return {
    version: 1,
    user: { id: 'local_me', nickName: '我', avatarUrl: '', role: '家长' },
    family: null,
    members: [],
    babies: [],
    currentBabyId: '',
    records: [],
    solidFoods: []
  }
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function watchSnapshotRecords(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.docs)) return null
  return snapshot.docs
}

function prependRecord(records, rec) {
  if (!rec) return records
  if (rec.id != null && records.some((r) => r.id === rec.id)) return records
  records.unshift(rec)
  return records
}

class Database {
  constructor() {
    this.mode = 'local'
    this.cloudReady = false
    this.state = emptyState()
    this.ready = false
    this._watchers = []
    this._recordWatcher = null
    this._watchedBabyId = ''
    this._refreshingRecords = false
    this._pendingRecordRefresh = false
  }

  async init() {
    this.cloudReady = false
    if (config.cloudEnv && typeof wx !== 'undefined' && wx.cloud) {
      try {
        wx.cloud.init({ env: config.cloudEnv, traceUser: true })
        this.cloudReady = true
        const storedFamilyId =
          (wx.getStorageSync && wx.getStorageSync('xiaoya_current_family')) || ''
        if (storedFamilyId) {
          const hasCloudFamily = await this._loadCloud(storedFamilyId)
          if (hasCloudFamily) {
            this.mode = 'cloud'
            this.ready = true
            this._startRecordWatch()
            this._notify()
            return this
          }
        }
      } catch (err) {
        console.warn('cloud init failed, fallback to local', err)
        this.cloudReady = false
      }
    }
    this.mode = 'local'
    this._loadLocal()
    this.ready = true
    this._notify()
    return this
  }

  onChange(fn) {
    this._watchers.push(fn)
    return () => {
      this._watchers = this._watchers.filter((w) => w !== fn)
    }
  }

  snapshot() {
    return {
      mode: this.mode,
      cloudReady: this.cloudReady,
      user: this.state.user,
      family: this.state.family,
      members: this.state.members.slice(),
      babies: this.state.babies.slice(),
      currentBabyId: this.state.currentBabyId,
      baby: this.currentBaby(),
      records: this.state.records.slice(),
      solidFoods: this.listSolidFoods()
    }
  }

  currentBaby() {
    const id = this.state.currentBabyId
    return this.state.babies.find((b) => b.id === id) || this.state.babies[0] || null
  }

  hasBaby() {
    return this.state.babies.length > 0
  }

  _notify() {
    const snap = this.snapshot()
    this._watchers.forEach((fn) => {
      try {
        fn(snap)
      } catch (e) {
        console.error(e)
      }
    })
  }

  _loadLocal() {
    try {
      const raw = typeof wx !== 'undefined' && wx.getStorageSync
        ? wx.getStorageSync(STORAGE_KEY)
        : this._mem || ''
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        this.state = Object.assign(emptyState(), parsed)
        if (!this.state.currentBabyId && this.state.babies[0]) {
          this.state.currentBabyId = this.state.babies[0].id
        }
      } else {
        this.state = emptyState()
      }
    } catch (e) {
      this.state = emptyState()
    }
  }

  _saveLocal() {
    const text = JSON.stringify(this.state)
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync(STORAGE_KEY, this.state)
    } else {
      this._mem = text
    }
  }

  persist() {
    if (this.mode === 'local') this._saveLocal()
    this._notify()
  }

  async _callManage(data) {
    try {
      const res = await wx.cloud.callFunction({ name: 'manageRecord', data })
      if (res.result && res.result.ok === false) {
        throw new Error(res.result.error || '操作失败')
      }
      return res.result
    } catch (err) {
      const msg = String((err && (err.errMsg || err.message)) || '')
      if (/FUNCTION_NOT_FOUND|cannot find/i.test(msg)) {
        throw new Error('请先上传云函数 manageRecord')
      }
      throw err
    }
  }

  async _loadCloud(preferredFamilyId) {
    const db = wx.cloud.database()
    const login = await wx.cloud.callFunction({ name: 'xiaoyaLogin' })
    const openid = (login.result && login.result.openid) || ''
    this.state.user = {
      id: openid,
      nickName: '我',
      avatarUrl: '',
      role: '家长'
    }

    const memberRes = await db.collection('xiaoya_members').where({ _openid: openid }).get()
    if (!memberRes.data.length) return false
    const storedFamilyId =
      preferredFamilyId ||
      (typeof wx !== 'undefined' && wx.getStorageSync && wx.getStorageSync('xiaoya_current_family')) ||
      ''
    let member = memberRes.data[0]
    if (storedFamilyId) {
      member = memberRes.data.find((m) => m.familyId === storedFamilyId) || member
    } else if (memberRes.data.length > 1) {
      member = memberRes.data.slice().sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))[0]
    }
    const familyId = member.familyId
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync('xiaoya_current_family', familyId)
    }
    const [familyRes, membersRes, babiesRes] = await Promise.all([
      db.collection('xiaoya_families').doc(familyId).get(),
      db.collection('xiaoya_members').where({ familyId }).get(),
      db.collection('xiaoya_babies').where({ familyId }).get()
    ])
    this.state.family = this._fromCloud(familyRes.data)
    this.state.solidFoods = Array.isArray(this.state.family.solidFoods)
      ? this.state.family.solidFoods.slice()
      : []
    this.state.members = membersRes.data.map((d) => this._fromCloud(d))
    this.state.babies = babiesRes.data.map((d) => this._fromCloud(d))
    const storedBaby = wx.getStorageSync('xiaoya_current_baby')
    const inFamily = this.state.babies.some((b) => b.id === storedBaby)
    this.state.currentBabyId = inFamily ? storedBaby : (this.state.babies[0] && this.state.babies[0].id) || ''
    if (this.state.currentBabyId && typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync('xiaoya_current_baby', this.state.currentBabyId)
    }
    await this._refreshCloudRecords()
    return true
  }

  async _refreshCloudRecords() {
    const baby = this.currentBaby()
    if (!baby) {
      this.state.records = []
      return
    }
    const db = wx.cloud.database()
    const PAGE = 20
    let all = []
    for (let i = 0; i < 10; i++) {
      const res = await db
        .collection('xiaoya_records')
        .where({ babyId: baby.id })
        .orderBy('startAt', 'desc')
        .skip(i * PAGE)
        .limit(PAGE)
        .get()
      all = all.concat(res.data.map((d) => this._fromCloud(d)))
      if (res.data.length < PAGE) break
    }
    this.state.records = all
  }

  async syncRecords() {
    if (this.mode !== 'cloud') return
    if (this._syncing) return this._syncing
    const now = Date.now()
    if (now - (this._lastSyncAt || 0) < 1000) return
    this._syncing = (async () => {
      try {
        await this._refreshCloudRecords()
        this._lastSyncAt = Date.now()
        this._notify()
        this._startRecordWatch()
      } finally {
        this._syncing = null
      }
    })()
    return this._syncing
  }

  _stopRecordWatch() {
    if (this._recordWatcher && this._recordWatcher.close) {
      try {
        this._recordWatcher.close()
      } catch (e) {
        console.warn('record watch close failed', e)
      }
    }
    this._recordWatcher = null
    this._watchedBabyId = ''
  }

  _startRecordWatch() {
    if (this.mode !== 'cloud' || typeof wx === 'undefined' || !wx.cloud) {
      this._stopRecordWatch()
      return
    }
    const baby = this.currentBaby()
    if (!baby) {
      this._stopRecordWatch()
      return
    }
    if (this._recordWatcher && this._watchedBabyId === baby.id) return
    this._stopRecordWatch()
    this._watchedBabyId = baby.id
    const cloudDb = wx.cloud.database()
    try {
      this._recordWatcher = cloudDb.collection('xiaoya_records')
        .where({ babyId: baby.id })
        .watch({
          onChange: (snapshot) => {
            this._onRecordWatchChange(snapshot)
          },
          onError: (err) => {
            console.warn('record watch error', err)
          }
        })
    } catch (e) {
      console.warn('record watch start failed', e)
      this._recordWatcher = null
      this._watchedBabyId = ''
    }
  }

  async _onRecordWatchChange(snapshot) {
    const docs = watchSnapshotRecords(snapshot)
    if (docs) {
      this.state.records = docs
        .map((d) => this._fromCloud(d))
        .sort((a, b) => (b.startAt || 0) - (a.startAt || 0))
      this._notify()
      return
    }
    if (!snapshot || snapshot.type === 'init') return
    this._pendingRecordRefresh = true
    if (this._refreshingRecords) return
    this._refreshingRecords = true
    try {
      while (this._pendingRecordRefresh) {
        this._pendingRecordRefresh = false
        await this._refreshCloudRecords()
        this._notify()
      }
    } catch (e) {
      console.warn('record watch refresh failed', e)
    } finally {
      this._refreshingRecords = false
    }
  }

  _fromCloud(doc) {
    if (!doc) return doc
    const row = Object.assign({}, doc)
    row.id = doc._id || doc.id
    return row
  }

  async createFamilyAndBaby(input) {
    const now = Date.now()
    const familyId = uid('fam')
    const babyId = uid('baby')
    const code = inviteCode(config.inviteCodeLength)
    const family = {
      id: familyId,
      name: input.familyName || `${input.babyName}的家`,
      inviteCode: code,
      createdAt: now,
      createdBy: this.state.user.id
    }
    const baby = {
      id: babyId,
      familyId,
      name: String(input.babyName || '').trim(),
      birthday: input.birthday,
      gender: input.gender || 'unknown',
      avatar: '',
      createdAt: now
    }
    const me = {
      id: this.state.user.id,
      familyId,
      nickName: this.state.user.nickName,
      role: '创建者',
      joinedAt: now
    }

    this.mode = 'local'
    this.state.family = family
    this.state.members = [me]
    this.state.babies = [baby]
    this.state.currentBabyId = babyId
    this.state.records = []
    this.persist()
    return this.snapshot()
  }

  async enableCloudSync() {
    if (!this.cloudReady || typeof wx === 'undefined' || !wx.cloud) {
      throw new Error('还没开通云开发')
    }
    if (this.mode === 'cloud') return this.snapshot()
    const baby = this.currentBaby()
    if (!baby || !this.state.family) throw new Error('请先给宝宝建一本')

    const localRecords = this.state.records.slice()
    const family = this.state.family
    const existed = await this._loadCloud()
    if (existed) {
      this.mode = 'cloud'
      this._startRecordWatch()
      this.persist()
      return this.snapshot()
    }

    await wx.cloud.callFunction({
      name: 'createFamily',
      data: {
        familyName: family.name,
        inviteCode: family.inviteCode,
        baby: {
          name: baby.name,
          birthday: baby.birthday,
          gender: baby.gender
        }
      }
    })
    const ok = await this._loadCloud()
    if (!ok) throw new Error('同步失败，请稍后重试')
    this.mode = 'cloud'

    if (localRecords.length && this.state.records.length === 0) {
      const oldestFirst = localRecords.slice().reverse()
      for (let i = 0; i < oldestFirst.length; i++) {
        const rec = oldestFirst[i]
        await this.addRecord({
          type: rec.type,
          subtype: rec.subtype,
          startAt: rec.startAt,
          endAt: rec.endAt,
          durationMin: rec.durationMin,
          amount: rec.amount,
          unit: rec.unit,
          note: rec.note,
          source: rec.source
        })
      }
    }

    this._startRecordWatch()
    this.persist()
    return this.snapshot()
  }

  async joinFamily(code) {
    const normalized = String(code || '').trim().toUpperCase()
    if (!normalized) throw new Error('请输入邀请码')

    if (this.cloudReady) {
      const res = await wx.cloud.callFunction({ name: 'joinFamily', data: { inviteCode: normalized } })
      const familyId = res.result && res.result.familyId
      if (typeof wx !== 'undefined' && wx.removeStorageSync) {
        wx.removeStorageSync('xiaoya_current_baby')
      }
      if (familyId && typeof wx !== 'undefined' && wx.setStorageSync) {
        wx.setStorageSync('xiaoya_current_family', familyId)
      }
      const ok = await this._loadCloud(familyId)
      if (!ok) throw new Error('已加入，但同步失败。请重新打开小程序。')
      this.mode = 'cloud'
      this._startRecordWatch()
      this.persist()
      return this.snapshot()
    }

    if (!this.state.family || this.state.family.inviteCode !== normalized) {
      throw new Error('本地模式无法跨设备加入。请在 config.js 填写云开发环境 ID，或让家人在同一部手机上记录。')
    }
    return this.snapshot()
  }

  async addBaby(input) {
    const baby = {
      id: uid('baby'),
      familyId: this.state.family && this.state.family.id,
      name: String(input.name || '').trim(),
      birthday: input.birthday,
      gender: input.gender || 'unknown',
      avatar: '',
      createdAt: Date.now()
    }
    if (this.mode === 'cloud') {
      const db = wx.cloud.database()
      const res = await db.collection('xiaoya_babies').add({ data: { ...baby, id: undefined } })
      baby.id = res._id
    }
    this.state.babies.push(baby)
    this.state.currentBabyId = baby.id
    if (this.mode === 'cloud') {
      this.state.records = []
      this._startRecordWatch()
    }
    this.persist()
    return baby
  }

  async updateBaby(id, patch) {
    const baby = this.state.babies.find((b) => b.id === id)
    if (!baby) return null
    Object.assign(baby, patch, { updatedAt: Date.now() })
    if (this.mode === 'cloud') {
      const db = wx.cloud.database()
      await db.collection('xiaoya_babies').doc(id).update({ data: patch })
    }
    this.persist()
    return baby
  }

  async switchBaby(id) {
    if (!this.state.babies.some((b) => b.id === id)) return
    this.state.currentBabyId = id
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      wx.setStorageSync('xiaoya_current_baby', id)
    }
    if (this.mode === 'cloud') {
      await this._refreshCloudRecords()
      this._startRecordWatch()
    }
    this.persist()
  }

  async addRecord(input) {
    const baby = this.currentBaby()
    if (!baby) throw new Error('还没有宝宝')
    const rec = {
      id: uid('rec'),
      babyId: baby.id,
      familyId: baby.familyId,
      type: input.type,
      subtype: input.subtype || '',
      startAt: input.startAt || Date.now(),
      endAt: input.endAt || null,
      durationMin: input.durationMin != null ? Number(input.durationMin) : null,
      amount: input.amount != null && input.amount !== '' ? Number(input.amount) : null,
      unit: input.unit || '',
      note: input.note || '',
      createdBy: this.state.user.id,
      createdByName: this.state.user.nickName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: input.source || 'quick'
    }
    if (rec.type === 'sleep' && rec.startAt && rec.endAt) {
      rec.durationMin = Math.max(1, Math.round((rec.endAt - rec.startAt) / 60000))
    }
    if (rec.type === 'breastfeed' && rec.durationMin == null && rec.amount != null) {
      rec.durationMin = rec.amount
    }

    if (this.mode === 'cloud') {
      const db = wx.cloud.database()
      const data = Object.assign({}, rec)
      delete data.id
      const res = await db.collection('xiaoya_records').add({ data })
      rec.id = res._id
    }

    prependRecord(this.state.records, rec)
    this.persist()
    return rec
  }

  async updateRecord(id, patch) {
    const rec = this.state.records.find((r) => r.id === id)
    if (!rec) return null
    const nextPatch = Object.assign({}, patch, { updatedAt: Date.now() })
    if ((rec.type === 'sleep' || nextPatch.type === 'sleep') && (nextPatch.startAt || rec.startAt) && (nextPatch.endAt || rec.endAt)) {
      const startAt = nextPatch.startAt != null ? nextPatch.startAt : rec.startAt
      const endAt = nextPatch.endAt != null ? nextPatch.endAt : rec.endAt
      nextPatch.durationMin = Math.max(1, Math.round((endAt - startAt) / 60000))
    }
    if (this.mode === 'cloud') {
      await this._callManage({ action: 'update', id, patch: nextPatch })
    }
    Object.assign(rec, nextPatch)
    if (rec.type === 'sleep' && rec.startAt && rec.endAt) {
      rec.durationMin = Math.max(1, Math.round((rec.endAt - rec.startAt) / 60000))
    }
    this.persist()
    return rec
  }

  async deleteRecord(id) {
    if (this.mode === 'cloud') {
      await this._callManage({ action: 'remove', id })
    }
    this.state.records = this.state.records.filter((r) => r.id !== id)
    this.persist()
  }

  async startSleep() {
    const existing = this.state.records.find((r) => r.type === 'sleep' && !r.endAt)
    if (existing) return existing
    return this.addRecord({ type: 'sleep', startAt: Date.now(), endAt: null, source: 'quick' })
  }

  async endSleep() {
    const existing = this.state.records.find((r) => r.type === 'sleep' && !r.endAt)
    if (!existing) return null
    return this.updateRecord(existing.id, { endAt: Date.now() })
  }

  listSolidFoods() {
    const fromRecords = this.state.records
      .filter((r) => r.type === 'solid' && r.subtype)
      .map((r) => r.subtype)
    return mergeSolidFoods(this.state.solidFoods, fromRecords)
  }

  async addSolidFood(name) {
    const n = String(name || '').trim()
    if (!n) return this.listSolidFoods()
    if (!this.state.solidFoods) this.state.solidFoods = []
    const exists = SOLID_FOODS.indexOf(n) >= 0 || this.state.solidFoods.indexOf(n) >= 0
    if (!exists) {
      this.state.solidFoods.push(n)
      if (this.state.family) this.state.family.solidFoods = this.state.solidFoods.slice()
      if (this.mode === 'cloud' && this.state.family && this.state.family.id) {
        try {
          const cloudDb = wx.cloud.database()
          await cloudDb.collection('xiaoya_families').doc(this.state.family.id).update({
            data: { solidFoods: this.state.solidFoods }
          })
        } catch (e) {
          console.warn('solidFoods cloud update failed', e)
        }
      }
      this.persist()
    }
    return this.listSolidFoods()
  }

  getRecord(id) {
    return this.state.records.find((r) => r.id === id) || null
  }

  exportAll() {
    return clone(this.state)
  }

  async importAll(payload) {
    if (!payload || payload.version !== 1) throw new Error('备份格式不对')
    this.state = Object.assign(emptyState(), payload)
    this.persist()
  }

  async resetLocal() {
    this._stopRecordWatch()
    this.mode = 'local'
    this.state = emptyState()
    this.persist()
  }
}

const db = new Database()
db.watchSnapshotRecords = watchSnapshotRecords
db.prependRecord = prependRecord
module.exports = db
