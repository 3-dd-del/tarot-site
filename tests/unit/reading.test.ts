import { describe, expect, it } from 'vitest'

import {
  CONTEXT_RATIO_MIN,
  buildContextLayer,
  buildCoreReading,
  buildPersonalReading,
  buildPositionReadings,
  buildSynthesis,
  focusDrawnCard,
  meetsContextRatio,
  type ReadingDrawnCard,
} from '../../src/lib/reading'
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

describe('逆位进入解读', () => {
  const card = majors.find((item) => item.id === 'major-13')!

  it('逆位在画面与象征之后多出一段，位置固定', () => {
    const upright = buildCoreReading(card, 'career')
    expect(upright.reversalLayer).toBeNull()
    expect(upright.paragraphs).toHaveLength(3)

    const reversed = buildCoreReading(card, 'career', { reversed: true })
    expect(reversed.reversalLayer).toBeTruthy()
    expect(reversed.paragraphs).toHaveLength(4)
    expect(reversed.paragraphs[2]).toBe(reversed.reversalLayer)
    expect(reversed.paragraphs[3]).toBe(reversed.contextLayer)
  })

  it('逆位不改变结合问题的那一段——语境层和正位时一模一样', () => {
    const upright = buildCoreReading(card, 'love')
    const reversed = buildCoreReading(card, 'love', { reversed: true })
    expect(reversed.contextLayer).toBe(upright.contextLayer)
  })

  it('个性化解读会说明这是逆位，并把牌阵归纳接在后面', () => {
    const reading = buildPersonalReading({
      card,
      categoryId: 'career',
      answers: {},
      reversed: true,
      extra: ['这一组里有 2 张是逆位。'],
    })
    expect(reading.paragraphs.join('')).toContain('（逆位）')
    expect(reading.paragraphs.join('')).toContain('这一组里有 2 张是逆位')
  })
})

describe('按牌位解读', () => {
  const picked: ReadingDrawnCard[] = ['major-00', 'swords-08', 'cups-05'].map((id, index) => ({
    card: [...majors, ...minors].find((item) => item.id === id)!,
    reversed: index === 1,
  }))

  it('逐张解读带着自己的牌位，顺序就是牌阵的顺序', () => {
    const readings = buildPositionReadings(picked, 'situation', 'career')
    expect(readings.map((item) => item.position.label)).toEqual(['现状', '阻碍', '建议'])
    expect(readings.map((item) => item.card.id)).toEqual([
      'major-00',
      'swords-08',
      'cups-05',
    ])
    for (const item of readings) {
      expect(item.text.startsWith(item.position.lead)).toBe(true)
      expect(item.text).toContain(buildContextLayer(item.card, 'career'))
    }
  })

  it('逆位的那一张带上逆位段，正位的不带', () => {
    const readings = buildPositionReadings(picked, 'situation', 'career')
    expect(readings[0]?.reversed).toBe(false)
    expect(readings[0]?.reversal).toBeNull()
    expect(readings[1]?.reversed).toBe(true)
    expect(readings[1]?.reversal).toBeTruthy()
  })

  it('多抽出来的牌不会挤进牌位', () => {
    const extra = [...picked, picked[0]!]
    expect(buildPositionReadings(extra, 'single', 'career')).toHaveLength(1)
  })

  it('个性化解读锚在建议位上', () => {
    expect(focusDrawnCard(picked, 'situation')?.card.id).toBe('cups-05')
    expect(focusDrawnCard(picked, 'timeline')?.card.id).toBe('cups-05')
    expect(focusDrawnCard(picked, 'single')?.card.id).toBe('major-00')
  })
})

describe('牌阵层面的归纳', () => {
  function drawnFor(ids: string[], reversedAt: number[] = []): ReadingDrawnCard[] {
    return ids.map((id, index) => ({
      card: [...majors, ...minors].find((item) => item.id === id)!,
      reversed: reversedAt.includes(index),
    }))
  }

  it('单张牌没有归纳段', () => {
    expect(buildSynthesis(drawnFor(['major-00']), 'single')).toEqual([])
  })

  it('三张全是大阿卡纳时，说明这件事分量不轻', () => {
    const notes = buildSynthesis(drawnFor(['major-00', 'major-01', 'major-02']), 'timeline')
    expect(notes.join('')).toContain('大阿卡纳')
  })

  it('全是小阿卡纳时，说明这是具体日常层面的事', () => {
    const notes = buildSynthesis(drawnFor(['wands-02', 'cups-05', 'swords-09']), 'timeline')
    expect(notes.join('')).toContain('小阿卡纳')
  })

  it('逆位的张数会进归纳：全逆位与过半逆位各有一句', () => {
    const all = buildSynthesis(
      drawnFor(['wands-02', 'cups-05', 'swords-09'], [0, 1, 2]),
      'timeline',
    )
    expect(all.join('')).toContain('全是逆位')

    const half = buildSynthesis(drawnFor(['wands-02', 'cups-05', 'swords-09'], [0, 1]), 'timeline')
    expect(half.join('')).toContain('2 张是逆位')
  })

  it('时间流会读过去与现在的花色关系', () => {
    const notes = buildSynthesis(drawnFor(['wands-02', 'wands-05', 'cups-09']), 'timeline')
    expect(notes.join('')).toContain('同一个花色')
  })

  it('处境牌阵会读出阻碍与建议是否在同一层', () => {
    const same = buildSynthesis(drawnFor(['major-00', 'wands-02', 'wands-05']), 'situation')
    expect(same.join('')).toContain('同一个花色')

    const apart = buildSynthesis(drawnFor(['major-00', 'swords-02', 'pentacles-05']), 'situation')
    expect(apart.join('')).toContain('不在同一层')
  })
})
