/**
 * 问题类型：界面选项、解读语境与内容校验共用同一份定义。
 * 一级分类不超过 8 个，二级每个不超过 5 个，与产品设计文档 4.1.1 一致。
 */

export const CATEGORY_IDS = [
  'love',
  'career',
  'study',
  'money',
  'decision',
  'self',
  'relation',
  'now',
] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export interface QuestionOption {
  id: string
  label: string
}

export interface QuestionCategory {
  id: CategoryId
  label: string
  /** 领域词，用于语境层拼接，例如「感情里」。 */
  domain: string
  questions: QuestionOption[]
}

export const CATEGORIES: QuestionCategory[] = [
  {
    id: 'love',
    label: '感情关系',
    domain: '感情里',
    questions: [
      { id: 'love-current', label: '我现在的这段关系' },
      { id: 'love-single', label: '单身与缘分' },
      { id: 'love-ambiguous', label: '暧昧，说不清的状态' },
      { id: 'love-breakup', label: '分手、复合与放下' },
      { id: 'love-continue', label: '这段关系还要不要继续' },
    ],
  },
  {
    id: 'career',
    label: '职业与事业',
    domain: '工作上',
    questions: [
      { id: 'career-current', label: '我目前工作的处境' },
      { id: 'career-search', label: '求职与机会' },
      { id: 'career-change', label: '要不要跳槽或转行' },
      { id: 'career-startup', label: '创业与副业' },
      { id: 'career-people', label: '与同事、上级的相处' },
    ],
  },
  {
    id: 'study',
    label: '学业与方向',
    domain: '学业上',
    questions: [
      { id: 'study-current', label: '现在的学业状态' },
      { id: 'study-exam', label: '考试与备考' },
      { id: 'study-path', label: '专业、方向、路径的选择' },
    ],
  },
  {
    id: 'money',
    label: '财务与资源',
    domain: '金钱上',
    questions: [
      { id: 'money-current', label: '我目前的金钱状况' },
      { id: 'money-spend', label: '一笔具体的支出或投入' },
      { id: 'money-relation', label: '我与金钱的关系' },
    ],
  },
  {
    id: 'decision',
    label: '一个具体决策',
    domain: '做决定时',
    questions: [
      { id: 'decision-ab', label: '二选一：A 还是 B' },
      { id: 'decision-whether', label: '要不要做某件事' },
      { id: 'decision-timing', label: '时机是否成熟' },
    ],
  },
  {
    id: 'self',
    label: '自我状态',
    domain: '自我状态上',
    questions: [
      { id: 'self-mood', label: '我最近的情绪' },
      { id: 'self-loop', label: '为什么我反复陷入同一个困境' },
      { id: 'self-blind', label: '我的优势与盲点' },
      { id: 'self-become', label: '我想成为一个不一样的人' },
    ],
  },
  {
    id: 'relation',
    label: '人际关系',
    domain: '人际关系里',
    questions: [
      { id: 'relation-friend', label: '与朋友之间' },
      { id: 'relation-family', label: '与家人之间' },
      { id: 'relation-unknown', label: '我看不太懂的某个人' },
    ],
  },
  {
    id: 'now',
    label: '当下与整体',
    domain: '当下的整体状态里',
    questions: [
      { id: 'now-today', label: '今天的状态' },
      { id: 'now-period', label: '这段时间的整体走向' },
      { id: 'now-unsaid', label: '有件事压在心里，但我说不清' },
    ],
  },
]

export const FREE_DRAW_ID = 'open-draw'
export const FREE_DRAW_LABEL = '说不清，直接抽一张牌'
export const FREE_DRAW_QUESTION = '此刻我需要看见的是什么'

const CATEGORY_MAP = new Map(CATEGORIES.map((category) => [category.id, category]))

export function getCategory(id: string | null | undefined): QuestionCategory | undefined {
  if (!id) return undefined
  return CATEGORY_MAP.get(id as CategoryId)
}

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORY_MAP.has(value as CategoryId)
}

export function findQuestion(id: string | null | undefined): QuestionOption | undefined {
  if (!id) return undefined
  if (id === FREE_DRAW_ID) return { id: FREE_DRAW_ID, label: FREE_DRAW_LABEL }
  for (const category of CATEGORIES) {
    const hit = category.questions.find((question) => question.id === id)
    if (hit) return hit
  }
  return undefined
}

/** 从二级选项反推一级分类——点击即前进，分类不能靠调用方记得传。 */
export function categoryOfQuestion(questionId: string | null | undefined): QuestionCategory | undefined {
  if (!questionId) return undefined
  return CATEGORIES.find((category) =>
    category.questions.some((question) => question.id === questionId),
  )
}
