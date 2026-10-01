/**
 * 牌阵与牌位。
 * 牌位不是装饰：同一张牌落在「阻碍」和落在「建议」，说的是两件事。
 * 每个牌位带一句 lead，用来把牌义接进这个位置（产品设计文档 4.3）。
 */

export const SPREAD_IDS = ['single', 'timeline', 'situation'] as const
export type SpreadId = (typeof SPREAD_IDS)[number]

export interface SpreadPosition {
  id: string
  /** 牌位名，摆牌与解读都用它 */
  label: string
  /** 这个牌位在问什么，选牌阵时展示 */
  prompt: string
  /** 解读时的引导句，把牌义接到位置上 */
  lead: string
}

/** 一张已经抽出来的牌：牌面 + 正逆位。 */
export interface DrawnCard {
  cardId: string
  reversed: boolean
}

export interface Spread {
  id: SpreadId
  name: string
  summary: string
  bestFor: string
  positions: SpreadPosition[]
}

export const SPREADS: Spread[] = [
  {
    id: 'single',
    name: '单张牌',
    summary: '一张牌，一个问题，一个角度。',
    bestFor: '想快速看清当下，或者今天只想抽一张',
    positions: [
      {
        id: 'now',
        label: '此刻',
        prompt: '这张牌照出你现在的位置',
        lead: '',
      },
    ],
  },
  {
    id: 'timeline',
    name: '时间流',
    summary: '三张牌依次排开：这件事从哪来、你站在哪、顺着走下去会到哪。',
    bestFor: '想知道一件事的来龙去脉，或者判断要不要继续',
    positions: [
      {
        id: 'past',
        label: '过去',
        prompt: '这件事从哪来',
        lead: '先看过去——这一段说的是事情是怎么走到今天的。',
      },
      {
        id: 'present',
        label: '现在',
        prompt: '你此刻站在哪里',
        lead: '再看现在——这一段说的是你此刻真实的位置。',
      },
      {
        id: 'future',
        label: '未来',
        prompt: '照现在走下去会到哪',
        lead: '最后看趋势——它不是预言，是顺着现在这条路走下去会到的方向。',
      },
    ],
  },
  {
    id: 'situation',
    name: '处境牌阵',
    summary: '三张牌分别说：你现在的处境、挡在中间的东西、可以动手的方向。',
    bestFor: '卡在一件事里，想知道该往哪使劲',
    positions: [
      {
        id: 'current',
        label: '现状',
        prompt: '你现在的处境',
        lead: '先看现状——这一段说的是你眼下真正的位置。',
      },
      {
        id: 'block',
        label: '阻碍',
        prompt: '挡在中间的东西',
        lead: '再说阻碍——这一段说的是卡住这件事的东西。',
      },
      {
        id: 'advice',
        label: '建议',
        prompt: '可以动手的方向',
        lead: '最后是可以动手的地方——这一段指的是你能使上劲的方向。',
      },
    ],
  },
]

const SPREAD_MAP = new Map(SPREADS.map((spread) => [spread.id, spread]))

export function getSpread(id: string | null | undefined): Spread {
  return SPREAD_MAP.get(id as SpreadId) ?? SPREADS[0]!
}

export function isSpreadId(value: string): value is SpreadId {
  return SPREAD_MAP.has(value as SpreadId)
}

export function cardCountOf(id: string | null | undefined): number {
  return getSpread(id).positions.length
}

/** 抽牌时给用户的提示：第 n 张对应哪个牌位。 */
export function positionAt(spreadId: string | null | undefined, index: number): SpreadPosition {
  const spread = getSpread(spreadId)
  return spread.positions[index] ?? spread.positions[spread.positions.length - 1]!
}

/** 建议从哪里读：有「建议」位就用它，否则用最后一张。 */
export function adviceIndex(spreadId: string | null | undefined): number {
  const spread = getSpread(spreadId)
  const index = spread.positions.findIndex((position) => position.id === 'advice')
  return index >= 0 ? index : spread.positions.length - 1
}

/** 正逆位的显示名，界面与出图共用。 */
export function orientationLabel(reversed: boolean): string {
  return reversed ? '逆位' : '正位'
}
