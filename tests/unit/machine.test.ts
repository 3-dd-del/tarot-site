import { describe, expect, it } from 'vitest'

import {
  confirmedQuestion,
  initialSession,
  questionKey,
  reduce,
  reviveSession,
  type DrawRecord,
  type Session,
} from '../../src/lib/machine'

const NOW = new Date('2026-10-01T20:00:00+08:00').getTime()
const SAME_DAY_LATER = NOW + 60 * 60 * 1000
const NEXT_DAY = NOW + 26 * 60 * 60 * 1000

function toConfirm(): Session {
  let session = reduce(initialSession(), { type: 'select-category', categoryId: 'love' })
  return reduce(session, { type: 'select-question', questionId: 'love-current' })
}

describe('抽牌主流程状态机', () => {
  it('从选问题到确认，再到抽牌', () => {
    const confirmed = toConfirm()
    expect(confirmed.stage).toBe('confirm')
    expect(confirmed.categoryId).toBe('love')

    const drawing = reduce(confirmed, { type: 'confirm' })
    expect(drawing.stage).toBe('draw')
  })

  it('点击问题直接前进，不需要提交按钮', () => {
    const session = reduce(initialSession(), {
      type: 'select-question',
      questionId: 'career-change',
    })
    expect(session.stage).toBe('confirm')
    expect(session.categoryId).toBe('career')
  })

  it('说不清就直接抽牌的出口，先走到确认再抽', () => {
    const session = reduce(initialSession(), { type: 'start-free-draw' })
    expect(session.stage).toBe('confirm')
    expect(session.freeDraw).toBe(true)
    expect(confirmedQuestion(session)).toBe('此刻我需要看见的是什么')
  })

  it('禁忌问题在问题选择阶段就被拦下，不进入抽牌', () => {
    const session = reduce(initialSession(), {
      type: 'select-question',
      questionId: 'self-mood',
    })
    const blocked = reduce(session, { type: 'set-note', text: '我是不是得了病' })
    expect(blocked.veto?.level).toBe('translate')

    const stillBlocked = reduce(
      { ...session, veto: { ...blocked.veto!, level: 'refuse' } },
      { type: 'confirm' },
    )
    expect(stillBlocked.stage).toBe('confirm')
  })

  it('抽牌记录时间戳，并进入核心解读', () => {
    const drawing = reduce(toConfirm(), { type: 'confirm' })
    const drawn = reduce(drawing, { type: 'draw', cardId: 'major-00', now: NOW, records: [] })
    expect(drawn.stage).toBe('core')
    expect(drawn.cardId).toBe('major-00')
    expect(drawn.drawnAt).toBe(NOW)
  })

  it('同一问题当天不可重抽，二次进入时给出提示', () => {
    const key = questionKey(toConfirm())
    const records: DrawRecord[] = [{ questionKey: key, cardId: 'major-17', drawnAt: NOW }]

    const again = reduce(toConfirm(), { type: 'confirm' })
    const blocked = reduce(again, {
      type: 'draw',
      cardId: 'major-01',
      now: SAME_DAY_LATER,
      records,
    })
    expect(blocked.cardId).toBeNull()
    expect(blocked.blockedCardId).toBe('major-17')
    expect(blocked.notice).toContain('今天不再重抽')
  })

  it('换了一天就可以重新抽', () => {
    const key = questionKey(toConfirm())
    const records: DrawRecord[] = [{ questionKey: key, cardId: 'major-17', drawnAt: NOW }]
    const again = reduce(toConfirm(), { type: 'confirm' })
    const drawn = reduce(again, {
      type: 'draw',
      cardId: 'major-02',
      now: NEXT_DAY,
      records,
    })
    expect(drawn.stage).toBe('core')
    expect(drawn.cardId).toBe('major-02')
  })

  it('回退到步骤 3 之前会清空已经抽到的牌并明确提示', () => {
    const drawn = reduce(reduce(toConfirm(), { type: 'confirm' }), {
      type: 'draw',
      cardId: 'major-00',
      now: NOW,
      records: [],
    })
    const back = reduce(drawn, { type: 'back' })
    expect(back.stage).toBe('confirm')
    expect(back.cardId).toBeNull()
    expect(back.notice).toContain('清空')
  })

  it('反思问答可以跳过，直接进入无个性化版本的第二层解读', () => {
    const answered = reduce(
      { ...initialSession(), stage: 'core', categoryId: 'love', cardId: 'major-00' },
      { type: 'answer', questionId: 'love-want', optionId: 'want-me' },
    )
    expect(answered.answers['love-want']).toBe('want-me')

    const skipped = reduce(answered, { type: 'skip-reflection' })
    expect(skipped.stage).toBe('personal')
    expect(skipped.answers).toEqual({})
  })

  it('继续按钮按步骤依次推进到收尾', () => {
    let session: Session = { ...initialSession(), stage: 'core', cardId: 'major-00' }
    session = reduce(session, { type: 'continue' })
    expect(session.stage).toBe('reflect')
    session = reduce(session, { type: 'continue' })
    expect(session.stage).toBe('personal')
    session = reduce(session, { type: 'continue' })
    expect(session.stage).toBe('finish')
  })

  it('会话恢复时坏数据回落到初始状态', () => {
    expect(reviveSession(null).stage).toBe('question')
    expect(reviveSession({ stage: '不存在的步骤' }).stage).toBe('question')
    const restored = reviveSession({ stage: 'draw', categoryId: 'career', userNote: '试试' })
    expect(restored.stage).toBe('draw')
    expect(restored.categoryId).toBe('career')
    expect(restored.answers).toEqual({})
  })
})
