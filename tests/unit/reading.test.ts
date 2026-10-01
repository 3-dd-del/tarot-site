import { describe, expect, it } from 'vitest'

import { CONTEXT_RATIO_MIN, buildContextLayer, buildCoreReading, buildPersonalReading, meetsContextRatio } from '../../src/lib/reading'
import { CATEGORY_IDS, CATEGORIES, getCategory } from '../../src/lib/questions'
import { loadCards } from './load-cards'

const cards = await loadCards()
const majors = cards.filter((item) => item.data.arcana === 'major').map((item) => item.card)
const minors = cards.filter((item) => item.data.arcana === 'minor').map((item) => item.card)

describe('三层解读拼接', () => {
  it('核心解读按「画面 → 象征 → 结合问题」的顺序拼接', () => {
    const card = majors[0]!
    const reading = buildCoreReading(card, 'love')
    expect(reading.paragraphs).toHaveLength(3)
    expect(reading.paragraphs[0]).toBe(card.sections.imagery)
    expect(reading.paragraphs[1]).toBe(card.sections.symbolism)
    expect(reading.paragraphs[2]).toBe(reading.contextLayer)
  })

  it('语境层占比不低于 40%，避免巴纳姆式的通用文案', () => {
    for (const card of majors) {
      for (const categoryId of CATEGORY_IDS) {
        const reading = buildCoreReading(card, categoryId)
        expect(
          reading.contextRatio,
          `${card.id} 在「${getCategory(categoryId)?.label}」下语境层占比只有 ${reading.contextRatio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(CONTEXT_RATIO_MIN)
        expect(meetsContextRatio(reading)).toBe(true)
      }
    }
  })

  it('同一张牌在不同问题下必须给出不同解读', () => {
    for (const card of majors) {
      const scenes = CATEGORY_IDS.map((categoryId) => buildContextLayer(card, categoryId))
      expect(new Set(scenes).size, `${card.id} 的场景文案出现重复`).toBe(CATEGORY_IDS.length)
    }
  })

  it('不同牌在同一个问题下的解读也不相同', () => {
    for (const category of CATEGORIES) {
      const scenes = majors.map((card) => buildContextLayer(card, category.id))
      expect(new Set(scenes).size).toBe(majors.length)
    }
  })

  it('大阿卡纳缺场景时直接报错，而不是退化成通用文案', () => {
    const broken = { ...majors[0]!, sections: { ...majors[0]!.sections, scenes: {} } }
    expect(() => buildCoreReading(broken, 'love')).toThrow(/缺少/)
  })
})

describe('小阿卡纳生成规则', () => {
  it('语境解读由花色倾向、数字阶段与牌义核心拼成', () => {
    const card = minors.find((item) => item.id === 'cups-05')!
    const scene = buildContextLayer(card, 'love')
    expect(scene).toContain('圣杯的底色')
    expect(scene).toContain('数字 5')
    expect(scene).toContain(card.sections.meaning.slice(0, 6))
  })

  it('同花色不同数字、同数字不同花色的输出都不同', () => {
    const aces = minors.filter((item) => item.number === 1)
    const scenes = aces.map((card) => buildContextLayer(card, 'career'))
    expect(new Set(scenes).size).toBe(aces.length)

    const cups = minors.filter((item) => item.suit === 'cups')
    const cupScenes = cups.map((card) => buildContextLayer(card, 'career'))
    expect(new Set(cupScenes).size).toBe(cups.length)
  })

  it('同一张小阿卡纳在不同问题下的落点不同', () => {
    const card = minors.find((item) => item.id === 'swords-09')!
    const scenes = CATEGORY_IDS.map((categoryId) => buildContextLayer(card, categoryId))
    expect(new Set(scenes).size).toBe(CATEGORY_IDS.length)
  })
})

describe('个性化层', () => {
  const card = majors.find((item) => item.id === 'major-00')!

  it('用户补充的原话会被回应一次', () => {
    const reading = buildPersonalReading({
      card,
      categoryId: 'love',
      answers: {},
      userNote: '我其实很怕失去现在的稳定',
    })
    expect(reading.paragraphs[0]).toContain('我其实很怕失去现在的稳定')
  })

  it('回答只改变落地方式，不改变牌的核心指向', () => {
    const withAnswer = buildPersonalReading({
      card,
      categoryId: 'love',
      answers: { 'love-want': 'want-me' },
    })
    const other = buildPersonalReading({
      card,
      categoryId: 'love',
      answers: { 'love-want': 'want-them' },
    })
    expect(withAnswer.leans).not.toEqual(other.leans)
    expect(withAnswer.advice).not.toBe(other.advice)
    expect(withAnswer.paragraphs.join('')).toContain('愚者')
    expect(other.paragraphs.join('')).toContain('愚者')
  })

  it('跳过反思问答时，仍然给出这张牌自己的建议', () => {
    const reading = buildPersonalReading({ card, categoryId: 'love', answers: {} })
    expect(reading.advice).toContain(card.sections.reflection[0]!)
    expect(reading.leans).toEqual([])
  })

  it('建议必须是具体到能执行的一句话', () => {
    for (const category of CATEGORIES) {
      const reading = buildPersonalReading({
        card,
        categoryId: category.id,
        answers: {},
      })
      expect(reading.advice.length, `${category.label} 的建议过短`).toBeGreaterThan(8)
    }
  })
})
