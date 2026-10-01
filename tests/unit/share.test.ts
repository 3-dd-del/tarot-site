import { describe, expect, it } from 'vitest'

import { BRAND, buildShareContent, summarize, wrapText } from '../../src/lib/share'

describe('分享出图内容', () => {
  it('三张牌阵：牌面、牌位与正逆位都进图', () => {
    const content = buildShareContent({
      cards: [
        {
          id: 'swords-08',
          name: '宝剑八',
          image: '/img/cards/swords-08.webp',
          label: '现状',
          reversed: false,
        },
        {
          id: 'wands-03',
          name: '权杖三',
          image: '/img/cards/wands-03.webp',
          label: '阻碍',
          reversed: true,
        },
        {
          id: 'cups-05',
          name: '圣杯五',
          image: '/img/cards/cups-05.webp',
          label: '建议',
          reversed: false,
        },
      ],
      spreadName: '处境',
      question: '我目前工作的处境',
      coreReading: '第一段。\n第二段。',
      advice: '今天先做一件具体的小事。',
    })

    expect(content.cards.map((card) => card.label)).toEqual(['现状', '阻碍', '建议'])
    expect(content.cards[1]).toEqual({
      id: 'wands-03',
      name: '权杖三',
      image: '/img/cards/wands-03.webp',
      label: '阻碍',
      reversed: true,
    })
    expect(content.spreadName).toBe('处境')
    expect(content.question).toBe('我目前工作的处境')
    expect(content.core).not.toContain('\n')
    expect(content.brand).toBe(BRAND)
  })

  it('出图最多三张，多出来的不画', () => {
    const content = buildShareContent({
      cards: Array.from({ length: 5 }, (_, index) => ({
        id: `major-0${index}`,
        name: `牌${index}`,
        image: `/img/cards/major-0${index}.webp`,
        label: `位${index}`,
        reversed: index % 2 === 1,
      })),
      spreadName: '测试',
      question: '问题',
      coreReading: '正文',
      advice: '建议',
    })
    expect(content.cards).toHaveLength(3)
  })

  it('单张牌时牌位可以为空', () => {
    const content = buildShareContent({
      cards: [
        {
          id: 'major-00',
          name: '愚者',
          image: '/img/cards/major-00.webp',
          label: '  ',
          reversed: false,
        },
      ],
      spreadName: '单张牌',
      question: '此刻我需要看见的是什么',
      coreReading: '正文',
      advice: '建议',
    })
    expect(content.cards[0]?.label).toBe('')
  })

  it('摘要超出上限时截断并加省略号', () => {
    expect(summarize('一二三四五', 3)).toBe('一二三…')
    expect(summarize('一二三', 5)).toBe('一二三')
  })

  it('折行按像素宽度计算，中文逐字断行', () => {
    const measure = (text: string) => text.length * 10
    expect(wrapText('一二三四五六', 30, measure)).toEqual(['一二三', '四五六'])
  })

  it('折行保留手动换行，并忽略空行', () => {
    const measure = (text: string) => text.length * 10
    expect(wrapText('第一行\n\n第二行', 100, measure)).toEqual(['第一行', '第二行'])
  })

  it('单字宽度大于限制时也不会死循环', () => {
    const measure = () => 999
    expect(wrapText('甲乙丙', 10, measure)).toEqual(['甲', '乙', '丙'])
  })
})
