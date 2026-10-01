/**
 * 解读生成：三层拼接（产品设计文档 5.2）。
 * ① 牌面层（静态）② 语境层（半静态）③ 个性化层（动态）
 * 个性化只改变落地方式，不改变结论。
 * 逆位是牌面层里多出来的一段，不改变这张牌在语境里指向的东西（11.5）。
 */

import type { CardSections } from './card-content'
import { coreMeaning, minorScene, type Suit } from './minor-rules'
import { getCategory, type CategoryId } from './questions'
import { reflectQuestions } from './reflect'
import { buildReversalLayer } from './reversal'
import { SUIT_LABELS, SUIT_TOPIC } from './minor-rules'
import { adviceIndex, getSpread, type Spread, type SpreadPosition } from './spreads'

export interface ReadingCard {
  id: string
  name: string
  nameEn: string
  arcana: 'major' | 'minor'
  suit: Suit | null
  number: number
  element: string
  keywords: string[]
  image: string
  sections: CardSections
}

/** 语境层在核心解读里的占比下限（产品设计文档 6.1）。 */
export const CONTEXT_RATIO_MIN = 0.4

export interface CoreReading {
  cardLayer: string
  contextLayer: string
  /** 逆位时的「逆位」段；正位为 null */
  reversalLayer: string | null
  paragraphs: string[]
  contextRatio: number
}

export function buildContextLayer(card: ReadingCard, categoryId: CategoryId): string {
  if (card.arcana === 'major') {
    const scene = card.sections.scenes[categoryId]
    if (!scene) {
      throw new Error(`牌 ${card.id} 缺少「${getCategory(categoryId)?.label}」场景文案`)
    }
    return scene
  }

  return minorScene(
    card.suit ?? 'wands',
    card.number,
    card.sections.meaning,
    categoryId,
  )
}

function countChars(text: string): number {
  return text.replace(/\s+/g, '').length
}

/** 核心解读：画面描述 → 象征含义 →（逆位）→ 结合问题意味着什么。 */
export function buildCoreReading(
  card: ReadingCard,
  categoryId: CategoryId,
  options: { reversed?: boolean } = {},
): CoreReading {
  const contextLayer = buildContextLayer(card, categoryId)

  const cardParts = [card.sections.imagery, card.sections.symbolism || card.sections.meaning].filter(
    Boolean,
  )
  const cardLayer = cardParts.join('\n')
  const reversalLayer = options.reversed ? buildReversalLayer(card) : null
  const paragraphs = reversalLayer
    ? [...cardParts, reversalLayer, contextLayer]
    : [...cardParts, contextLayer]

  const contextChars = countChars(contextLayer)
  const totalChars =
    countChars(cardLayer) + contextChars + (reversalLayer ? countChars(reversalLayer) : 0)

  return {
    cardLayer,
    contextLayer,
    reversalLayer,
    paragraphs,
    contextRatio: totalChars === 0 ? 0 : contextChars / totalChars,
  }
}

export interface PersonalReadingInput {
  card: ReadingCard
  categoryId: CategoryId
  answers: Record<string, string>
  userNote?: string
  /** 这张牌是不是逆位 */
  reversed?: boolean
  /** 牌阵层面的归纳段，插在牌的角度之后 */
  extra?: string[]
}

export interface PersonalReading {
  paragraphs: string[]
  advice: string
  leans: string[]
}

/** 个性化解读：呼应原话 → 牌的角度 → 回答带来的侧重 → 一句可执行建议。 */
export function buildPersonalReading({
  card,
  categoryId,
  answers,
  userNote = '',
  reversed = false,
  extra = [],
}: PersonalReadingInput): PersonalReading {
  const paragraphs: string[] = []
  const leans: string[] = []
  const advices: string[] = []

  const note = userNote.trim()
  if (note) {
    const quote = note.length > 40 ? `${note.slice(0, 40)}…` : note
    paragraphs.push(
      `你自己写的是「${quote}」。这句话值得先放在这里——愿意把话说清楚的人，通常已经比昨天更接近答案了。`,
    )
  }

  const anchor = coreMeaning(card.sections.meaning) || card.sections.meaning
  if (anchor) {
    paragraphs.push(
      `从${card.name}${reversed ? '（逆位）' : ''}的角度看，${anchor}。${
        reversed ? '它现在被压在里面，所以别急着往外推，先看看是什么把它按住了。' : ''
      }这不是一个需要你马上解决的结论，而是接下来一段时间可以反复回来对照的一句话。`,
    )
  }

  paragraphs.push(...extra)

  for (const question of reflectQuestions(categoryId)) {
    const answerId = answers[question.id]
    const option = question.options.find((item) => item.id === answerId)
    if (!option) continue
    leans.push(option.lean)
    advices.push(option.advice)
  }

  if (leans.length > 0) {
    paragraphs.push(leans.join(''))
  }

  const advice =
    advices[0] ??
    (card.sections.reflection[0]
      ? `这张牌留了一个问题给你，值得认真回答一次：${card.sections.reflection[0]}`
      : '今天先做一件具体的小事，不用急着把整件事想完。')

  return { paragraphs, advice, leans }
}

/** 自检：语境层占比是否达标，供测试与内容评审使用。 */
export function meetsContextRatio(reading: CoreReading): boolean {
  return reading.contextRatio >= CONTEXT_RATIO_MIN
}

/* ---------- 牌阵：多张牌、按牌位解读 ---------- */

/** 牌 + 正逆位，解读层的入参。 */
export interface ReadingDrawnCard {
  card: ReadingCard
  reversed: boolean
}

export interface PositionReading {
  position: SpreadPosition
  card: ReadingCard
  reversed: boolean
  /** 一句话画面，多张牌时用来保持版式紧凑 */
  imagery: string
  /** 逆位说明；正位为 null */
  reversal: string | null
  /** 牌位引导句 + 语境层 */
  text: string
}

/** 取第一句，避免多张牌时画面描述占掉太多版面。 */
function firstSentence(text: string): string {
  const plain = text.replace(/\s+/g, '')
  const match = /^[^。！？]*[。！？]/.exec(plain)
  return match ? match[0] : plain
}

/**
 * 按牌位逐张解读。
 * 同一个问题下，每张牌都取该问题类型的语境层，再接到它所在的牌位上——
 * 语境层本身是逐条写过的，所以换一张牌、换一个位置，读到的都不是同一段话。
 */
export function buildPositionReadings(
  drawn: ReadingDrawnCard[],
  spreadId: string,
  categoryId: CategoryId,
): PositionReading[] {
  const spread = getSpread(spreadId)
  return drawn.slice(0, spread.positions.length).map((item, index) => {
    const position = spread.positions[index]!
    const card = item.card
    const context = buildContextLayer(card, categoryId)
    return {
      position,
      card,
      reversed: item.reversed,
      imagery: firstSentence(card.sections.imagery),
      reversal: item.reversed ? buildReversalLayer(card) : null,
      text: `${position.lead}${context}`,
    }
  })
}

/** 个性化层的锚点：有「建议」位就用它，否则用最后一张。 */
export function focusDrawnCard(
  drawn: ReadingDrawnCard[],
  spreadId: string,
): ReadingDrawnCard | undefined {
  return drawn[adviceIndex(spreadId)] ?? drawn[drawn.length - 1]
}

/**
 * 牌阵层面的归纳：不看单张，看牌与牌之间的关系。
 * 这是"多张牌"相比单张牌真正多出来的信息。
 */
export function buildSynthesis(drawn: ReadingDrawnCard[], spreadId: string): string[] {
  const spread: Spread = getSpread(spreadId)
  const notes: string[] = []
  if (drawn.length < 2) return notes

  const cards = drawn.map((item) => item.card)
  const reversedCount = drawn.filter((item) => item.reversed).length

  if (reversedCount === drawn.length) {
    notes.push('这一组全是逆位：事情还没有走到外面，多半还在你自己这里消化，这时候硬推效果不好。')
  } else if (reversedCount > 0 && reversedCount >= Math.ceil(drawn.length / 2)) {
    notes.push(`这一组里有 ${reversedCount} 张是逆位：有一部分还压在水面下，别只看已经摆到台面上的那部分。`)
  }

  const majors = cards.filter((card) => card.arcana === 'major').length
  if (majors === cards.length) {
    notes.push('这几张全是大阿卡纳，说明这件事牵动的东西比表面看起来多，不是一个能随手处理的小问题。')
  } else if (majors >= 2) {
    notes.push(`三张里有 ${majors} 张大阿卡纳，这件事在你这里的分量不轻。`)
  } else if (majors === 0) {
    notes.push('三张都是小阿卡纳，说明这件事更偏具体的日常层面，不用把它上升到人生课题。')
  }

  const suitCounts = new Map<Suit, number>()
  for (const card of cards) {
    if (card.suit) suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1)
  }
  const top = [...suitCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] === cards.length) {
    notes.push(
      `三张牌全落在${SUIT_LABELS[top[0]]}上，这件事基本可以归到一个主题里：${SUIT_TOPIC[top[0]]}。`,
    )
  } else if (top && top[1] >= 2) {
    notes.push(`有两张落在${SUIT_LABELS[top[0]]}上，${SUIT_TOPIC[top[0]]}这条线是这件事的主线。`)
  }

  if (spread.id === 'timeline' && cards.length === 3) {
    const [past, present, future] = cards as [ReadingCard, ReadingCard, ReadingCard]
    if (past.suit && past.suit === present.suit) {
      notes.push('过去和现在是同一个花色，说明那个模式还在延续，事情并没有真正翻篇。')
    }
    if (future.arcana === 'major') {
      notes.push('未来位上是大阿卡纳，说明走向里有一部分不由你单方面决定，你能改的是自己这一段。')
    }
  }

  if (spread.id === 'situation' && cards.length === 3) {
    const [, block, advice] = cards as [ReadingCard, ReadingCard, ReadingCard]
    if (block.suit && block.suit === advice.suit) {
      notes.push('阻碍和建议落在同一个花色上：卡住你的那件事，和你能动手的那件事，其实是同一件。')
    } else if (block.suit && advice.suit) {
      notes.push(
        `阻碍在${SUIT_LABELS[block.suit]}，建议在${SUIT_LABELS[advice.suit]}——卡住你的事和能使上劲的地方不在同一层，别在原地用力。`,
      )
    }
    if (advice.arcana === 'minor') {
      notes.push('建议位是小阿卡纳，说明这一步不需要什么大动作，做一件具体的小事就够。')
    }
  }

  return notes
}
