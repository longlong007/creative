const RECORD_TYPES = {
  milk: { key: 'milk', label: '喝奶', unit: 'ml', color: '#E07A5F', bg: '#FBE4DC' },
  breastfeed: { key: 'breastfeed', label: '亲喂', unit: '分钟', color: '#D9897A', bg: '#F8E6E1' },
  sleep: { key: 'sleep', label: '睡眠', unit: '分钟', color: '#6B86B3', bg: '#E4EAF4' },
  diaper: { key: 'diaper', label: '尿布', unit: '', color: '#C4A882', bg: '#F3EBDD' },
  height: { key: 'height', label: '身高', unit: 'cm', color: '#6A9E8A', bg: '#E3F0EA' },
  weight: { key: 'weight', label: '体重', unit: 'kg', color: '#5B8F7A', bg: '#E3F0EA' },
  temperature: { key: 'temperature', label: '体温', unit: '°C', color: '#C45C4A', bg: '#F8E0DB' },
  solid: { key: 'solid', label: '辅食', unit: '', color: '#C9963A', bg: '#F7EDD6' },
  note: { key: 'note', label: '备注', unit: '', color: '#8A8178', bg: '#EEEAE4' }
}

const MILK_SUBTYPES = [
  { key: 'formula', label: '配方奶', type: 'milk', unit: 'ml' },
  { key: 'breast_bottle', label: '母乳瓶喂', type: 'milk', unit: 'ml' },
  { key: 'left', label: '亲喂·左', type: 'breastfeed', unit: '分钟' },
  { key: 'right', label: '亲喂·右', type: 'breastfeed', unit: '分钟' },
  { key: 'both', label: '亲喂·双侧', type: 'breastfeed', unit: '分钟' }
]

const DIAPER_SUBTYPES = [
  { key: 'pee', label: '嘘嘘', emoji: '💧' },
  { key: 'poop', label: '便便', emoji: '🟡' },
  { key: 'both', label: '都有', emoji: '💧🟡' }
]

const SOLID_FOODS = [
  '婴儿米粉',
  '南瓜泥',
  '胡萝卜泥',
  '土豆泥',
  '香蕉泥',
  '苹果泥',
  '鸡蛋黄',
  '西兰花',
  '肉泥',
  '酸奶'
]

function mergeSolidFoods(custom, fromRecords) {
  const seen = new Set()
  const out = []
  SOLID_FOODS.concat(custom || []).concat(fromRecords || []).forEach((name) => {
    const n = String(name || '').trim()
    if (!n || seen.has(n)) return
    seen.add(n)
    out.push(n)
  })
  return out
}

const MILK_AMOUNTS = [60, 90, 120, 150, 180, 210]
const BREAST_MINUTES = [5, 8, 10, 15, 20, 30]
const TIME_OFFSETS = [
  { key: 'now', label: '现在', minutes: 0 },
  { key: 'm5', label: '5分钟前', minutes: -5 },
  { key: 'm15', label: '15分钟前', minutes: -15 },
  { key: 'm30', label: '30分钟前', minutes: -30 },
  { key: 'm60', label: '1小时前', minutes: -60 },
  { key: 'custom', label: '补录', minutes: 0 }
]

const MORE_ACTIONS = [
  { key: 'height', label: '身高', desc: 'cm', type: 'height' },
  { key: 'weight', label: '体重', desc: 'kg', type: 'weight' },
  { key: 'temperature', label: '体温', desc: '°C', type: 'temperature' },
  { key: 'solid', label: '辅食', desc: '一口一口', type: 'solid' },
  { key: 'note', label: '备注', desc: '一句话', type: 'note' }
]

const FORM_TITLES = {
  height: '记身高',
  weight: '记体重',
  temperature: '记体温',
  solid: '记辅食',
  note: '记备注',
  diaper: '补记尿布'
}

module.exports = {
  RECORD_TYPES,
  MILK_SUBTYPES,
  DIAPER_SUBTYPES,
  SOLID_FOODS,
  mergeSolidFoods,
  MILK_AMOUNTS,
  BREAST_MINUTES,
  TIME_OFFSETS,
  MORE_ACTIONS,
  FORM_TITLES
}
