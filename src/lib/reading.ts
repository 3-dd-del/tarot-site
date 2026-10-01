/**
 * 解读生成：三层拼接（产品设计文档 5.2）。
 * ① 牌面层（静态）② 语境层（半静态）③ 个性化层（动态）
 * 个性化只改变落地方式，不改变结论。
 */

import type { CardSections } from './card-content'
import { coreMeaning, minorScene, type Suit } from './minor-rules'
import { getCategory, type CategoryId } from './questions'
import { reflectQuestions } from './reflect'

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

/** 核心解读：画面描述 → 象征含义 → 结合问题意味着什么。 */
export function buildCoreReading(card: ReadingCard, categoryId: CategoryId): CoreReading {
  const contextLayer = buildContextLayer(card, categoryId)

  const cardParts = [card.sections.imagery, card.sections.symbolism || card.sections.meaning].filter(
    Boolean,
  )
  const cardLayer = cardParts.join('\n')

  const contextChars = countChars(contextLayer)
  const totalChars = countChars(cardLayer) + contextChars

  return {
    cardLayer,
    contextLayer,
    paragraphs: [...cardParts, contextLayer],
    contextRatio: totalChars === 0 ? 0 : contextChars / totalChars,
  }
}

export interface PersonalReadingInput {
  card: ReadingCard
  categoryId: CategoryId
  answers: Record<string, string>
  userNote?: string
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
      `从${card.name}的角度看，${anchor}。这不是一个需要你马上解决的结论，而是接下来一段时间可以反复回来对照的一句话。`,
    )
  }

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
