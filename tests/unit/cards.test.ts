import { stat } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { MAJOR_REQUIRED_SECTIONS, parseCardBody, validateSections } from '../../src/lib/card-content'
import { CATEGORIES } from '../../src/lib/questions'
import { BANNED_PHRASES } from '../../src/lib/taboo'
import { loadCards, repoRoot } from './load-cards'

const SUITS = ['wands', 'cups', 'swords', 'pentacles'] as const

function expectedIds(): string[] {
  const ids = Array.from({ length: 22 }, (_, index) => `major-${String(index).padStart(2, '0')}`)
  for (const suit of SUITS) {
    for (let index = 1; index <= 14; index += 1) {
      ids.push(`${suit}-${String(index).padStart(2, '0')}`)
    }
  }
  return ids.sort()
}

const cards = await loadCards()

describe('牌数据文件', () => {
  it('78 张牌齐全，文件名与命名规则一致', () => {
    expect(cards).toHaveLength(78)
    expect(cards.map((item) => item.fileName.replace(/\.mdx$/, '')).sort()).toEqual(expectedIds())
    for (const item of cards) {
      expect(item.data.id, `${item.fileName} 的 frontmatter id 与文件名不一致`).toBe(
        item.fileName.replace(/\.mdx$/, ''),
      )
    }
  })

  it('frontmatter 字段与牌组归属自洽', () => {
    for (const { data, fileName } of cards) {
      const isMajor = data.id.startsWith('major-')
      expect(data.arcana, fileName).toBe(isMajor ? 'major' : 'minor')
      if (isMajor) {
        expect(data.suit, fileName).toBeNull()
        expect(data.number).toBeGreaterThanOrEqual(0)
        expect(data.number).toBeLessThanOrEqual(21)
      } else {
        expect(SUITS, fileName).toContain(data.suit)
        expect(data.number).toBeGreaterThanOrEqual(1)
        expect(data.number).toBeLessThanOrEqual(14)
      }
      expect(data.keywords.length, fileName).toBeGreaterThanOrEqual(2)
      expect(data.keywords.length, fileName).toBeLessThanOrEqual(6)
      expect(data.image, fileName).toBe(`/img/cards/${data.id}.webp`)
      expect(data.name.length, fileName).toBeGreaterThan(0)
      expect(data.nameEn.length, fileName).toBeGreaterThan(0)
    }
  })

  it('每张牌都能指到真实的牌面图片', async () => {
    for (const { data } of cards) {
      const file = path.join(repoRoot, 'public', data.image.replace(/^\//, ''))
      await expect(stat(file), `${data.id} 的图片不存在`).resolves.toBeTruthy()
    }
  })
})

describe('章节结构校验', () => {
  it('大阿卡纳六个小节齐全，顺序固定', () => {
    for (const { data, body } of cards.filter((item) => item.data.arcana === 'major')) {
      const sections = parseCardBody(body, data.id)
      expect(() => validateSections(sections, data.id, body, { arcana: 'major' })).not.toThrow()
      for (const heading of MAJOR_REQUIRED_SECTIONS) {
        expect(body, `${data.id} 缺少「${heading}」`).toContain(`## ${heading}`)
      }
    }
  })

  it('大阿卡纳的分场景含义覆盖全部一级问题分类', () => {
    for (const { data, body } of cards.filter((item) => item.data.arcana === 'major')) {
      const sections = parseCardBody(body, data.id)
      for (const category of CATEGORIES) {
        expect(sections.scenes[category.id], `${data.id} 缺少「${category.label}」`).toBeTruthy()
      }
    }
  })

  it('小阿卡纳是简化版，但必备小节不能少', () => {
    for (const { data, body } of cards.filter((item) => item.data.arcana === 'minor')) {
      const sections = parseCardBody(body, data.id)
      expect(() => validateSections(sections, data.id, body, { arcana: 'minor' })).not.toThrow()
      expect(sections.imagery.length).toBeGreaterThan(10)
      expect(sections.meaning.length).toBeGreaterThan(10)
      expect(sections.reflection.length).toBeGreaterThan(0)
    }
  })

  it('小节缺失或顺序错误会直接抛错，不会悄悄放过', () => {
    const broken = '## 通用含义\n\n内容\n\n## 反思问题\n\n- 问题一\n'
    const sections = parseCardBody(broken, 'major-00')
    expect(() => validateSections(sections, 'major-00', broken, { arcana: 'major' })).toThrow(
      /缺少小节/,
    )

    const wrongOrder = [
      '## 通用含义',
      '内容',
      '## 画面',
      '内容',
      '## 反思问题',
      '- 问题一',
    ].join('\n\n')
    expect(() =>
      validateSections(parseCardBody(wrongOrder, 'wands-01'), 'wands-01', wrongOrder, {
        arcana: 'minor',
      }),
    ).toThrow(/顺序/)
  })

  it('场景标题必须是一级问题分类', () => {
    const body = [
      '## 画面',
      '内容',
      '## 通用含义',
      '内容',
      '## 分场景含义',
      '### 不存在的分类',
      '内容',
      '## 反思问题',
      '- 问题一',
    ].join('\n\n')
    expect(() => parseCardBody(body, 'wands-01')).toThrow(/不是合法的一级问题分类/)
  })
})

describe('文案规范', () => {
  it('全站文案不出现禁用表述与商标用词', () => {
    const hits: string[] = []
    for (const { data, body } of cards) {
      for (const phrase of BANNED_PHRASES) {
        if (body.includes(phrase)) hits.push(`${data.id} 命中「${phrase}」`)
      }
    }
    expect(hits).toEqual([])
  })

  it('解读文本满足核心解读的长度预算', () => {
    for (const { data, body } of cards.filter((item) => item.data.arcana === 'major')) {
      const sections = parseCardBody(body, data.id)
      const length = sections.imagery.length + sections.symbolism.length
      expect(length, `${data.id} 的牌面层过短`).toBeGreaterThan(85)
      expect(length, `${data.id} 的牌面层过长`).toBeLessThan(420)
    }
  })
})
