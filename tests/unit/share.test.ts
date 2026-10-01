import { describe, expect, it } from 'vitest'

import { BRAND, buildShareContent, summarize, wrapText } from '../../src/lib/share'

describe('分享出图内容', () => {
  it('出图内容包含牌面、问题、解读摘要与建议', () => {
    const content = buildShareContent({
      cardId: 'major-00',
      cardName: '愚者',
      cardNameEn: 'The Fool',
      cardImage: '/img/cards/major-00.webp',
      question: '我现在的这段关系',
      coreReading: '一个年轻人站在悬崖边缘。\n他手里只拿着一朵白玫瑰。',
      advice: '今天先做一件具体的小事。',
    })

    expect(content.cardName).toBe('愚者')
    expect(content.question).toBe('我现在的这段关系')
    expect(content.core).not.toContain('\n')
    expect(content.brand).toBe(BRAND)
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
