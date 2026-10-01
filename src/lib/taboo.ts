/**
 * 内容禁忌的硬拦截（产品设计文档第 9 节）。
 * 拦截发生在问题选择阶段，抽牌之前；规则与文案都在这里，不靠撰稿人自觉。
 */

export type TabooLevel = 'ok' | 'translate' | 'care' | 'refuse'

export type TabooCategoryId = 'life-death' | 'health' | 'numbers' | 'gambling' | 'crime'

export interface TabooResource {
  label: string
  value: string
}

export interface TabooVerdict {
  level: TabooLevel
  category: TabooCategoryId | null
  title: string
  message: string
  /** 转译后的提问角度，level 为 translate 时展示。 */
  rewrite: string | null
  resources: TabooResource[]
}

export const OK_VERDICT: TabooVerdict = {
  level: 'ok',
  category: null,
  title: '',
  message: '',
  rewrite: null,
  resources: [],
}

/** 生死与自伤：终止解读，给出关怀文案与专业求助渠道。文案提前写好，不临时生成。 */
const CARE_KEYWORDS = [
  '自杀',
  '自残',
  '轻生',
  '不想活',
  '不想活了',
  '活不下去',
  '结束生命',
  '结束自己',
  '了结自己',
  '伤害自己',
  '想死',
  '去死',
  '安乐死',
  '还能活多久',
  '活多久',
  '寿命',
  '什么时候死',
  '会不会死',
  '会死吗',
  '去世',
  '死亡时间',
  '绝症',
  '癌症晚期',
  '遗书',
]

/** 作奸犯科：立即终止，不作任何回应。 */
const CRIME_KEYWORDS = [
  '犯法',
  '违法',
  '犯罪',
  '坐牢',
  '判刑',
  '逃避法律',
  '逃过法律',
  '不被发现',
  '报复他',
  '报复她',
  '报复别人',
  '伤害他人',
  '伤害别人',
  '打人',
  '下药',
  '偷东西',
  '偷窃',
  '诈骗',
  '骗钱',
  '造假',
  '洗钱',
  '跟踪他',
  '跟踪她',
  '找人麻烦',
]

/** 健康：不解读，转译成「我可以怎样照顾自己」。 */
const HEALTH_KEYWORDS = [
  '确诊',
  '诊断',
  '什么病',
  '得了病',
  '生病',
  '有病吗',
  '病重',
  '病情',
  '手术',
  '化疗',
  '吃药',
  '用药',
  '吃什么药',
  '要不要停药',
  '停药',
  '治疗方案',
  '能治好吗',
  '痊愈',
  '康复',
  '癌症',
  '肿瘤',
  '抑郁',
  '抑郁症',
  '焦虑症',
  '怀孕',
  '怀了',
  '胎儿',
  '孩子健康',
  '试管',
  '流产',
]

/** 数字与赌博：不解读，说明这不在塔罗能回应的范围内。 */
const NUMBERS_KEYWORDS = [
  '彩票',
  '中奖',
  '中奖号码',
  '开奖',
  '大奖',
  '号码',
  '选号',
  '几号',
  '具体日期',
  '哪一天',
  '涨还是跌',
  '会不会涨',
  '股价',
  '股票',
  '基金',
  '币价',
  '赚多少钱',
  '能赚多少',
  '多少钱',
  '回报率',
]

const GAMBLING_KEYWORDS = [
  '赌博',
  '赌钱',
  '赌局',
  '赌一把',
  '下注',
  '投注',
  '押注',
  '牌局',
  '赌球',
  '麻将赢',
  '赌场',
]

interface Rule {
  category: TabooCategoryId
  level: Exclude<TabooLevel, 'ok'>
  keywords: string[]
  title: string
  message: string
  rewrite: string | null
  resources?: TabooResource[]
}

export const CARE_RESOURCES: TabooResource[] = [
  { label: '全国 24 小时心理援助热线', value: '12356' },
  { label: '希望 24 热线', value: '400-161-9995' },
  { label: '北京心理危机研究与干预中心', value: '010-82951332' },
]

const RULES: Rule[] = [
  {
    category: 'life-death',
    level: 'care',
    keywords: CARE_KEYWORDS,
    title: '先停一下，这件事比一张牌重要',
    message:
      '如果这段时间你常常想到“活着没有意义”，或者有过伤害自己的念头，请先别急着抽牌。这不是牌能承接的事，你值得被真实的人接住。可以现在就联系下面的渠道，也可以在明天告诉一个你信任的人。',
    rewrite: null,
    resources: CARE_RESOURCES,
  },
  {
    category: 'crime',
    level: 'refuse',
    keywords: CRIME_KEYWORDS,
    title: '这个方向我不做解读',
    message:
      '涉及违法、伤害他人、逃避后果的问题，本站一律不解读，换一张牌也不会有答案。如果你正卡在某件麻烦事里，可以问一个更贴近自己的问题：我为什么会走到这一步，我现在能做什么让自己不再往下掉。',
    rewrite: '我为什么会走到这一步，我现在能做什么',
  },
  {
    category: 'health',
    level: 'translate',
    keywords: HEALTH_KEYWORDS,
    title: '身体的事，交给医生更稳妥',
    message:
      '疾病、用药、检查结果、怀孕这些事需要专业的检查与判断，塔罗给不了可信的答案，随便给反而可能让你耽误正事。把问题换个角度，牌仍然对你有用：',
    rewrite: '面对现在的身体状况，我可以怎样照顾自己',
  },
  {
    category: 'numbers',
    level: 'refuse',
    keywords: NUMBERS_KEYWORDS,
    title: '具体的数字与日期，塔罗回应不了',
    message:
      '彩票号码、开奖结果、股票涨跌、具体赚多少这类问题，答案要么是随机的，要么取决于大量你看不到的信息，任何“算出来”的说法都是编的。你可以改问：面对这个决定，我该关注哪些自己可控的因素。',
    rewrite: '面对这个决定，我该关注哪些自己可控的因素',
  },
  {
    category: 'gambling',
    level: 'translate',
    keywords: GAMBLING_KEYWORDS,
    title: '输赢我不猜，但可以聊聊你为什么想赌',
    message:
      '赌局的走向不在塔罗能回应的范围内，我也不会给你投注建议。不过有一点牌可以帮你看清：现在是什么把你推到牌桌边上。换个角度问，这张牌仍然有意义。',
    rewrite: '我为什么这么想赌，我在期待它解决什么',
  },
]

/** 否定语境：「我不想去伤害别人」不该被当成违法类问题拦下来。 */
const CRIME_NEGATION =
  /(不想|不愿|不会|不要|不能|不敢|不该|没有|不去)[^，。；!？]{0,4}(伤害|报复|打人|偷|骗|犯法|违法|犯罪)|不(伤害|报复|打人|偷|骗|犯法|违法|犯罪)/

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s，。！？、,.!?;:;:"'“”‘’（）()\-_/]/g, '')
}

/** 命中关键词，并且没有出现在否定语境里。 */
function hits(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalize(keyword)))
}

/**
 * 判定一个问题是可回答、需要转译，还是必须终止。
 * 优先级：生死自伤 > 作奸犯科 > 健康 > 数字 > 赌博。
 */
export function evaluateQuestion(rawText: string): TabooVerdict {
  const text = normalize(rawText ?? '')
  if (!text) return OK_VERDICT

  for (const rule of RULES) {
    if (rule.category === 'crime' && CRIME_NEGATION.test(text)) continue
    if (hits(text, rule.keywords)) {
      return {
        level: rule.level,
        category: rule.category,
        title: rule.title,
        message: rule.message,
        rewrite: rule.rewrite,
        resources: rule.resources ?? [],
      }
    }
  }

  return OK_VERDICT
}

export function isBlocked(verdict: TabooVerdict): boolean {
  return verdict.level === 'care' || verdict.level === 'refuse'
}

export const TABOO_CATEGORY_LABELS: Record<TabooCategoryId, string> = {
  'life-death': '生死与自伤',
  health: '健康与医疗',
  numbers: '数字与输赢',
  gambling: '赌博',
  crime: '违法与伤害他人',
}

/** 定位规则，供测试逐类覆盖。 */
export function ruleKeywords(category: TabooCategoryId): string[] {
  const rule = RULES.find((item) => item.category === category)
  return rule ? [...rule.keywords] : []
}

export const BANNED_PHRASES = [
  '预测命运',
  '保证准确',
  '百分百准',
  '改运',
  '转运',
  '化解',
  '破解',
  '必灵',
  'Rider-Waite',
  'Rider Waite',
  'Rider-Waite-Smith',
  '伟特',
]
