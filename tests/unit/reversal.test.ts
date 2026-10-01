import { describe, expect, it } from 'vitest'

import { coreMeaning } from '../../src/lib/minor-rules'
import {
  REVERSAL_NOTE,
  REVERSAL_SHAPE_LABELS,
  buildReversalLayer,
  reversalShape,
} from '../../src/lib/reversal'
import { loadCards } from './load-cards'

const cards = await loadCards()

describe('逆位解读', () => {
  it('78 张牌都能生成逆位段，而且都接回这张牌自己的牌义', () => {
    for (const { card } of cards) {
      const layer = buildReversalLayer(card)
      const core = coreMeaning(card.sections.meaning)
      expect(core.length, `${card.id} 没有可用的牌义核心`).toBeGreaterThan(4)
      expect(layer, `${card.id} 的逆位段没有接回自己`).toContain(core)
      expect(layer.length, `${card.id} 的逆位段太短，像一句套话`).toBeGreaterThan(60)
    }
  })

  it('不同牌义的逆位段互不相同，不是一段通用文案', () => {
    const layers = cards.map((item) => buildReversalLayer(item.card))
    const cores = cards.map((item) => coreMeaning(item.card.sections.meaning))
    expect(new Set(layers).size).toBe(new Set(cores).size)
  })

  it('形态按元素分配：火是过度、水是向内、风与土是受阻', () => {
    for (const { card } of cards) {
      const shape = reversalShape(card)
      if (card.element === 'fire') expect(shape).toBe('excess')
      else if (card.element === 'water') expect(shape).toBe('inward')
      else expect(shape).toBe('blocked')
    }
  })

  it('三种形态都真的用到了', () => {
    const used = new Set(cards.map((item) => reversalShape(item.card)))
    expect([...used].sort()).toEqual(Object.keys(REVERSAL_SHAPE_LABELS).sort())
  })

  it('大阿卡纳的逆位先说清这是大课题，小阿卡纳不这么说', () => {
    for (const { card } of cards) {
      const layer = buildReversalLayer(card)
      if (card.arcana === 'major') {
        expect(layer, `${card.id} 的逆位没有大阿卡纳的定性`).toContain('大阿卡纳')
      } else {
        expect(layer, `${card.id} 不该出现大阿卡纳的定性`).not.toContain('大阿卡纳')
      }
    }
  })

  it('给用户的说明口径与教学页一致：逆位不是坏消息', () => {
    expect(REVERSAL_NOTE).toContain('不是坏消息')
  })
})
