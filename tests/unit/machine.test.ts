import { describe, expect, it } from 'vitest'

import {
  cardCount,
  confirmedQuestion,
  initialSession,
  questionKey,
  reduce,
  reviveSession,
  type DrawRecord,
  type Session,
} from '../../src/lib/machine'
import type { SpreadId } from '../../src/lib/spreads'

const NOW = new Date('2026-10-01T20:00:00+08:00').getTime()
const SAME_DAY_LATER = NOW + 60 * 60 * 1000
const NEXT_DAY = NOW + 26 * 60 * 60 * 1000

function toConfirm(): Session {
  const picked = reduce(initialSession(), { type: 'select-category', categoryId: 'love' })
  return reduce(picked, { type: 'select-question', questionId: 'love-current' })
}

/** 选完问题后一路走到抽牌阶段。 */
function toDraw(spreadId: SpreadId = 'single', options: { records?: DrawRecord[]; now?: number } = {}) {
  const confirmed = reduce(toConfirm(), {
    type: 'confirm',
    now: options.now ?? NOW,
    records: options.records ?? [],
  })
  return reduce(confirmed, { type: 'choose-spread', spreadId })
}

/** 按顺序抽满并翻完整个牌阵。 */
function drawAll(
  session: Session,
  cards: { cardId: string; reversed?: boolean }[],
  now = NOW,
): Session {
  let next = session
  for (const card of cards) {
    next = reduce(next, {
      type: 'pick-card',
      cardId: card.cardId,
      reversed: card.reversed ?? false,
      now,
    })
    next = reduce(next, { type: 'reveal-card' })
  }
  return next
}

describe('抽牌主流程状态机', () => {
  it('从选问题到确认，再到选牌阵', () => {
    const confirmed = toConfirm()
    expect(confirmed.stage).toBe('confirm')
    expect(confirmed.categoryId).toBe('love')

    const choosingSpread = reduce(confirmed, { type: 'confirm' })
    expect(choosingSpread.stage).toBe('spread')

    const drawing = reduce(choosingSpread, { type: 'choose-spread', spreadId: 'timeline' })
    expect(drawing.stage).toBe('draw')
    expect(drawing.spreadId).toBe('timeline')
    expect(cardCount(drawing)).toBe(3)
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
    // 没有分类的出口也必须落在「当下与整体」下，否则解读取不到语境层
    expect(session.categoryId).toBe('now')
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

  it('抽一张：抽够张数并翻开之后才进入核心解读', () => {
    const drawing = toDraw('single')
    const picked = reduce(drawing, {
      type: 'pick-card',
      cardId: 'major-00',
      reversed: false,
      now: NOW,
    })
    expect(picked.stage).toBe('draw')
    expect(picked.cards).toEqual([{ cardId: 'major-00', reversed: false }])
    expect(picked.drawnAt).toBe(NOW)

    const revealed = reduce(picked, { type: 'reveal-card' })
    expect(revealed.stage).toBe('core')
    expect(revealed.revealed).toBe(1)
  })

  it('抽三张：翻到第三张之前都留在抽牌阶段', () => {
    let session = toDraw('timeline')
    session = reduce(session, {
      type: 'pick-card',
      cardId: 'major-01',
      reversed: false,
      now: NOW,
    })
    session = reduce(session, { type: 'reveal-card' })
    expect(session.stage).toBe('draw')

    session = reduce(session, {
      type: 'pick-card',
      cardId: 'major-02',
      reversed: true,
      now: NOW,
    })
    session = reduce(session, { type: 'reveal-card' })
    expect(session.stage).toBe('draw')

    session = reduce(session, {
      type: 'pick-card',
      cardId: 'major-03',
      reversed: false,
      now: NOW,
    })
    session = reduce(session, { type: 'reveal-card' })
    expect(session.stage).toBe('core')
    expect(session.cards.map((card) => card.cardId)).toEqual(['major-01', 'major-02', 'major-03'])
  })

  it('正逆位跟着牌一起记下来，不会在流程里被丢掉', () => {
    const session = drawAll(toDraw('situation'), [
      { cardId: 'wands-03', reversed: true },
      { cardId: 'cups-05', reversed: false },
      { cardId: 'swords-09', reversed: true },
    ])
    expect(session.cards).toEqual([
      { cardId: 'wands-03', reversed: true },
      { cardId: 'cups-05', reversed: false },
      { cardId: 'swords-09', reversed: true },
    ])
    expect(session.revealed).toBe(3)
  })

  it('同一张牌不会在一局里出现两次，抽满之后不再接受新牌', () => {
    let session = toDraw('single')
    session = reduce(session, {
      type: 'pick-card',
      cardId: 'major-04',
      reversed: false,
      now: NOW,
    })
    const duplicate = reduce(session, {
      type: 'pick-card',
      cardId: 'major-04',
      reversed: true,
      now: NOW,
    })
    expect(duplicate.cards).toHaveLength(1)

    const overflow = reduce(session, {
      type: 'pick-card',
      cardId: 'major-05',
      reversed: false,
      now: NOW,
    })
    expect(overflow.cards).toHaveLength(1)
  })

  it('同一问题当天不可重抽，二次进入时给出提示', () => {
    const key = questionKey(toConfirm())
    const records: DrawRecord[] = [
      { questionKey: key, cards: [{ cardId: 'major-17', reversed: true }], drawnAt: NOW },
    ]

    const again = toDraw('single', { records, now: SAME_DAY_LATER })
    expect(again.stage).toBe('draw')
    expect(again.cards).toEqual([])
    expect(again.blockedCards).toEqual([{ cardId: 'major-17', reversed: true }])
    expect(again.notice).toContain('今天不再重抽')
  })

  it('换了一天就可以重新抽', () => {
    const key = questionKey(toConfirm())
    const records: DrawRecord[] = [
      { questionKey: key, cards: [{ cardId: 'major-17', reversed: false }], drawnAt: NOW },
    ]
    const again = toDraw('single', { records, now: NEXT_DAY })
    expect(again.stage).toBe('draw')
    expect(again.blockedCards).toEqual([])

    const drawn = drawAll(again, [{ cardId: 'major-02' }], NEXT_DAY)
    expect(drawn.stage).toBe('core')
    expect(drawn.cards[0]?.cardId).toBe('major-02')
  })

  it('回退到抽牌之前会清空已经抽到的牌并明确提示', () => {
    const drawn = drawAll(toDraw('single'), [{ cardId: 'major-00', reversed: true }])
    const back = reduce(drawn, { type: 'back' })
    expect(back.stage).toBe('confirm')
    expect(back.cards).toEqual([])
    expect(back.notice).toContain('清空')

    const fromSpread = reduce(toDraw('timeline'), { type: 'back' })
    expect(fromSpread.stage).toBe('spread')
    expect(fromSpread.cards).toEqual([])
  })

  it('反思问答可以跳过，直接进入无个性化版本的第二层解读', () => {
    const answered = reduce(
      { ...initialSession(), stage: 'core', categoryId: 'love', cards: [] },
      { type: 'answer', questionId: 'love-want', optionId: 'want-me' },
    )
    expect(answered.answers['love-want']).toBe('want-me')

    const skipped = reduce(answered, { type: 'skip-reflection' })
    expect(skipped.stage).toBe('personal')
    expect(skipped.answers).toEqual({})
  })

  it('继续按钮按步骤依次推进到收尾', () => {
    let session: Session = { ...initialSession(), stage: 'core', cards: [] }
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

  it('会话恢复时兼容旧的 cardIds 格式，并按牌阵张数截断', () => {
    const legacy = reviveSession({
      stage: 'core',
      spreadId: 'timeline',
      cardIds: ['major-00', 'major-01', 'major-02', 'major-03'],
      revealed: 9,
    })
    expect(legacy.spreadId).toBe('timeline')
    expect(legacy.cards).toEqual([
      { cardId: 'major-00', reversed: false },
      { cardId: 'major-01', reversed: false },
      { cardId: 'major-02', reversed: false },
    ])
    expect(legacy.revealed).toBe(3)

    const broken = reviveSession({
      stage: 'draw',
      spreadId: 'single',
      cards: [{ nope: true }, { cardId: 'major-09', reversed: true }],
    })
    expect(broken.cards).toEqual([{ cardId: 'major-09', reversed: true }])
  })
})
