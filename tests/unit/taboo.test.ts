import { describe, expect, it } from 'vitest'

import {
  BANNED_PHRASES,
  CARE_RESOURCES,
  evaluateQuestion,
  isBlocked,
  ruleKeywords,
  type TabooCategoryId,
} from '../../src/lib/taboo'

const SAMPLES: Record<TabooCategoryId, string> = {
  'life-death': '我活不下去了，还有必要继续吗',
  health: '我是不是得了什么病，要不要做手术',
  numbers: '下期彩票中奖号码是多少',
  gambling: '这场赌局我下注哪边会赢',
  crime: '我想报复别人，有什么办法',
}

describe('内容禁忌硬拦截', () => {
  it('每一类禁忌都能被识别，并且给出对应等级', () => {
    expect(evaluateQuestion(SAMPLES['life-death']).level).toBe('care')
    expect(evaluateQuestion(SAMPLES.health).level).toBe('translate')
    expect(evaluateQuestion(SAMPLES.numbers).level).toBe('refuse')
    expect(evaluateQuestion(SAMPLES.gambling).level).toBe('translate')
    expect(evaluateQuestion(SAMPLES.crime).level).toBe('refuse')
  })

  it('关键词清单逐类覆盖，不会出现空规则', () => {
    for (const category of Object.keys(SAMPLES) as TabooCategoryId[]) {
      const keywords = ruleKeywords(category)
      expect(keywords.length).toBeGreaterThan(2)
      for (const keyword of keywords) {
        const verdict = evaluateQuestion(`请问${keyword}这件事`)
        expect(verdict.category, `关键词「${keyword}」没被任何规则接住`).toBe(category)
      }
    }
  })

  it('生死与自伤终止解读，并给出专业求助渠道', () => {
    const verdict = evaluateQuestion(SAMPLES['life-death'])
    expect(isBlocked(verdict)).toBe(true)
    expect(verdict.resources.length).toBeGreaterThan(0)
    expect(verdict.resources).toEqual(CARE_RESOURCES)
    expect(verdict.message).toContain('联系')
  })

  it('健康、数字与赌博给出可回答的替代问法', () => {
    for (const category of ['health', 'numbers', 'gambling'] as TabooCategoryId[]) {
      const verdict = evaluateQuestion(SAMPLES[category])
      expect(verdict.rewrite, `${category} 缺少替代问法`).toBeTruthy()
    }
  })

  it('转译类不阻断流程，拒绝类阻断流程', () => {
    expect(isBlocked(evaluateQuestion(SAMPLES.health))).toBe(false)
    expect(isBlocked(evaluateQuestion(SAMPLES.gambling))).toBe(false)
    expect(isBlocked(evaluateQuestion(SAMPLES.numbers))).toBe(true)
    expect(isBlocked(evaluateQuestion(SAMPLES.crime))).toBe(true)
  })

  it('正常问题不会被误伤', () => {
    for (const text of [
      '我现在的这段关系',
      '要不要跳槽或转行',
      '我最近的情绪',
      '这笔钱该不该花',
      '我不想去伤害别人',
      '',
    ]) {
      expect(evaluateQuestion(text).level, `「${text}」被误判`).toBe('ok')
    }
  })

  it('禁用表述清单固定下来，供全站文案校验使用', () => {
    for (const phrase of ['预测命运', '保证准确', '改运', '化解', '转运', '破解', '必灵']) {
      expect(BANNED_PHRASES).toContain(phrase)
    }
  })
})
