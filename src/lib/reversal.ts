/**
 * 正逆位（教学页第 6 课的口径，产品设计文档 11.5）。
 *
 * 三种逆位读法：能量受阻、能量向内、能量过度。
 * 形态由元素决定，但每一段都接回这张牌自己的牌义——
 * 逆位不是一句通用话术，底色必须和正位一致。
 */

import { coreMeaning } from './minor-rules'

export type ReversalShape = 'blocked' | 'inward' | 'excess'

export const REVERSAL_SHAPE_LABELS: Record<ReversalShape, string> = {
  blocked: '能量受阻',
  inward: '能量向内',
  excess: '能量过度',
}

/** 元素决定形态：风与土是受阻，水向内，火过头。 */
const SHAPE_BY_ELEMENT: Record<string, ReversalShape> = {
  air: 'blocked',
  earth: 'blocked',
  water: 'inward',
  fire: 'excess',
}

const SHAPE_TEXT: Record<ReversalShape, string> = {
  blocked: '正位讲的那件事是存在的，只是现在被卡住了——不是没有，而是动不了。',
  inward: '同一件事，方向掉了个头：原本指向外面的，现在转回来指向你自己。',
  excess: '这张牌正位时的好处，眼下用过了头，正在变成它的反面。',
}

const ELEMENT_TEXT: Record<string, string> = {
  air: '落到想法和沟通上，就是同一个念头在脑子里转圈，越转越窄，话也没有说出口。',
  fire: '落到行动上，就是急着往前推，力气使在了并不需要用力推的地方。',
  water: '落到感受上，就是情绪没有流出去，积在里面慢慢发酵。',
  earth: '落到现实条件上，就是该落地的部分还没有落地，时间、身体、钱都悬在半空。',
}

/** 结构性入参：ReadingCard 天然满足，避免和 reading.ts 形成循环依赖。 */
export interface ReversalSubject {
  name: string
  arcana: 'major' | 'minor'
  number: number
  element: string
  sections: { meaning: string }
}

export function reversalShape(card: ReversalSubject): ReversalShape {
  return SHAPE_BY_ELEMENT[card.element] ?? 'blocked'
}

/**
 * 逆位层的正文。
 * 结构：大阿卡纳的定性 → 形态 → 元素层面 → 这张牌自己的牌义。
 */
export function buildReversalLayer(card: ReversalSubject): string {
  const shape = reversalShape(card)
  const element = ELEMENT_TEXT[card.element] ?? ELEMENT_TEXT['air']!
  const core = coreMeaning(card.sections.meaning)

  const head =
    card.arcana === 'major'
      ? '这是大阿卡纳，逆位时说的不是小事出了岔子，而是这个大课题正压在你身上。'
      : ''

  return `${head}${SHAPE_TEXT[shape]}${element}牌义的底色没有变：${core}——只是这一层现在藏在里面，还没有走到外面。`
}

/** 第一次看到逆位的人需要一句说明，链接指向教学页。 */
export const REVERSAL_NOTE = '逆位不是坏消息，它只是同一张牌的另一种读法，底色和正位是一样的。'
