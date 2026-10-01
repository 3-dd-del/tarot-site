import { describe, expect, it } from 'vitest'

import {
  SPREADS,
  SPREAD_IDS,
  adviceIndex,
  cardCountOf,
  getSpread,
  orientationLabel,
  positionAt,
} from '../../src/lib/spreads'

describe('牌阵定义', () => {
  it('三个牌阵：单张牌、时间流、处境', () => {
    expect(SPREAD_IDS).toEqual(['single', 'timeline', 'situation'])
    expect(SPREADS.map((spread) => spread.name)).toEqual(['单张牌', '时间流', '处境牌阵'])
    expect(SPREADS[0]?.positions.map((position) => position.label)).toEqual(['此刻'])
    expect(SPREADS[1]?.positions.map((position) => position.label)).toEqual([
      '过去',
      '现在',
      '未来',
    ])
    expect(SPREADS[2]?.positions.map((position) => position.label)).toEqual([
      '现状',
      '阻碍',
      '建议',
    ])
  })

  it('每个牌位都有自己的名字与问法，多张牌阵还带引导句', () => {
    for (const spread of SPREADS) {
      for (const position of spread.positions) {
        expect(position.label.length, `${spread.id} 的牌位缺少名字`).toBeGreaterThan(0)
        expect(position.prompt.length, `${spread.id} 的牌位缺少问法`).toBeGreaterThan(4)
        if (spread.positions.length > 1) {
          expect(position.lead.length, `${spread.id} 的牌位缺少引导句`).toBeGreaterThan(4)
        }
      }
    }
  })

  it('位置不同，引导句就不同——同一张牌落在不同位置读法不该一样', () => {
    for (const spread of SPREADS.filter((item) => item.positions.length > 1)) {
      const leads = spread.positions.map((position) => position.lead)
      expect(new Set(leads).size, `${spread.id} 的牌位引导句出现重复`).toBe(leads.length)
    }
  })

  it('未知牌阵回落到单张牌，不抛错', () => {
    expect(getSpread('nope').id).toBe('single')
    expect(getSpread(null).id).toBe('single')
    expect(cardCountOf('nope')).toBe(1)
  })

  it('抽牌提示按牌位顺序给出', () => {
    expect(positionAt('timeline', 0).label).toBe('过去')
    expect(positionAt('timeline', 1).label).toBe('现在')
    expect(positionAt('timeline', 2).label).toBe('未来')
    // 越界的索引回落到最后一个牌位，不会抛错
    expect(positionAt('timeline', 9).label).toBe('未来')
  })

  it('建议位决定个性化解读的锚点', () => {
    expect(adviceIndex('situation')).toBe(2)
    expect(adviceIndex('timeline')).toBe(2)
    expect(adviceIndex('single')).toBe(0)
  })

  it('正逆位有统一的显示名', () => {
    expect(orientationLabel(true)).toBe('逆位')
    expect(orientationLabel(false)).toBe('正位')
  })
})
