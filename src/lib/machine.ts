/**
 * 抽牌主流程的状态机（产品设计文档 4、技术方案 4.1）。
 * 纯函数实现，与 DOM 解耦，可以直接用单测覆盖状态迁移。
 *
 * question → confirm → spread → draw → core → reflect（可跳过）→ personal → finish
 *
 * draw 阶段是"玩家自己动手"的部分：洗牌、切牌、按牌位顺序一张张抽、一张张翻。
 * 洗牌与切牌是纯表现，牌面与正逆位由 pick-card 一张张记录，翻牌进度由 reveal 记录。
 */

import type { CategoryId } from './questions'
import { FREE_DRAW_ID, categoryOfQuestion, findQuestion, getCategory } from './questions'
import { getSpread } from './spreads'
import type { DrawnCard, SpreadId } from './spreads'
import { evaluateQuestion, isBlocked, type TabooVerdict } from './taboo'

export const STAGES = [
  'question',
  'confirm',
  'spread',
  'draw',
  'core',
  'reflect',
  'personal',
  'finish',
] as const

export type Stage = (typeof STAGES)[number]

export interface DrawRecord {
  questionKey: string
  cards: DrawnCard[]
  drawnAt: number
}

export interface Session {
  stage: Stage
  categoryId: CategoryId | null
  questionId: string | null
  userNote: string
  freeDraw: boolean
  /** 牌阵：决定抽几张、每张落在哪个牌位 */
  spreadId: SpreadId
  /** 按抽取顺序记录的牌，第 n 张对应第 n 个牌位。正逆位一并记在这里 */
  cards: DrawnCard[]
  /** 已经翻开的张数，用来实现"一张张翻" */
  revealed: number
  drawnAt: number | null
  answers: Record<string, string>
  notice: string | null
  veto: TabooVerdict | null
  /** 翻牌后被拦下的"当天不可重抽"提示，存当时抽到的牌 */
  blockedCards: DrawnCard[]
}

export function initialSession(): Session {
  return {
    stage: 'question',
    categoryId: null,
    questionId: null,
    userNote: '',
    freeDraw: false,
    spreadId: 'single',
    cards: [],
    revealed: 0,
    drawnAt: null,
    answers: {},
    notice: null,
    veto: null,
    blockedCards: [],
  }
}

export type SessionEvent =
  | { type: 'select-category'; categoryId: CategoryId }
  | { type: 'select-question'; questionId: string }
  | { type: 'start-free-draw' }
  | { type: 'set-note'; text: string }
  | { type: 'confirm'; now?: number; records?: DrawRecord[] }
  | { type: 'choose-spread'; spreadId: SpreadId }
  | { type: 'pick-card'; cardId: string; reversed: boolean; now: number }
  | { type: 'reveal-card' }
  | { type: 'back' }
  | { type: 'answer'; questionId: string; optionId: string }
  | { type: 'continue' }
  | { type: 'skip-reflection' }
  | { type: 'restart' }

export function questionLabel(session: Session): string {
  if (session.freeDraw) return '此刻我需要看见的是什么'
  return findQuestion(session.questionId)?.label ?? ''
}

/** 确认后的问题：二级选项 + 用户补充的原话。 */
export function confirmedQuestion(session: Session): string {
  const label = questionLabel(session)
  const note = session.userNote.trim()
  if (!note) return label
  return label ? `${label}（${note}）` : note
}

export function questionKey(session: Session): string {
  const base = session.freeDraw ? 'free' : (session.questionId ?? 'unknown')
  const note = session.userNote.trim()
  return note ? `${base}|${note}` : base
}

export function localDay(now: number): string {
  return new Date(now).toDateString()
}

/** 当天同一问题是否已经抽过，抽过则返回那条记录。 */
export function findTodayRecord(
  records: DrawRecord[],
  key: string,
  now: number,
): DrawRecord | undefined {
  return records.find(
    (record) => record.questionKey === key && localDay(record.drawnAt) === localDay(now),
  )
}

export function cardCount(session: Session): number {
  return getSpread(session.spreadId).positions.length
}

/** 是否已经把牌抽齐并全部翻开。 */
export function isDrawComplete(session: Session): boolean {
  return session.cards.length === cardCount(session) && session.revealed >= session.cards.length
}

function withVeto(session: Session, text: string): Session {
  const verdict = evaluateQuestion(text)
  return { ...session, veto: verdict.level === 'ok' ? null : verdict }
}

/** 当前状态下的问题文本，用于禁忌判定（问题选择阶段就拦下来）。 */
function draftText(session: Session): string {
  return `${questionLabel(session)} ${session.userNote}`
}

function blocked(session: Session): boolean {
  return session.veto !== null && isBlocked(session.veto)
}

function resetDraw(session: Session): Pick<Session, 'cards' | 'revealed' | 'drawnAt'> {
  return { cards: [], revealed: 0, drawnAt: null }
}

export function reduce(session: Session, event: SessionEvent): Session {
  switch (event.type) {
    case 'select-category':
      return { ...session, categoryId: event.categoryId, notice: null }

    case 'select-question': {
      const category = categoryOfQuestion(event.questionId)
      const next: Session = {
        ...session,
        questionId: event.questionId,
        categoryId: category?.id ?? session.categoryId,
        freeDraw: false,
        notice: null,
      }
      const checked = withVeto(next, draftText(next))
      if (blocked(checked)) {
        return checked
      }
      return { ...checked, stage: 'confirm' }
    }

    case 'start-free-draw': {
      const next: Session = {
        ...session,
        questionId: FREE_DRAW_ID,
        freeDraw: true,
        // 直接抽牌这个问题归到「当下与整体」下面，语境层才有对应的落点。
        categoryId: 'now',
        notice: null,
      }
      return { ...withVeto(next, draftText(next)), stage: 'confirm' }
    }

    case 'set-note': {
      const next: Session = { ...session, userNote: event.text, notice: null }
      return withVeto(next, draftText(next))
    }

    case 'confirm': {
      if (blocked(session)) return session
      if (session.stage !== 'confirm') return session

      // 当天同一个问题不重抽：翻牌前就告诉他，不用白走一遍洗牌。
      const now = event.now ?? Date.now()
      const existing = findTodayRecord(event.records ?? [], questionKey(session), now)
      if (existing) {
        return {
          ...session,
          ...resetDraw(session),
          stage: 'draw',
          blockedCards: existing.cards,
          notice: '你已经为这个问题抽过牌了，今天不再重抽。可以看看当时的结果，也可以换一个问题。',
        }
      }

      return {
        ...session,
        ...resetDraw(session),
        stage: 'spread',
        blockedCards: [],
        notice: null,
      }
    }

    case 'choose-spread': {
      if (session.stage !== 'spread') return session
      return { ...session, spreadId: event.spreadId, ...resetDraw(session), stage: 'draw' }
    }

    case 'pick-card': {
      if (session.stage !== 'draw') return session
      if (session.blockedCards.length > 0) return session
      if (session.cards.length >= cardCount(session)) return session
      if (session.cards.some((card) => card.cardId === event.cardId)) return session
      return {
        ...session,
        cards: [...session.cards, { cardId: event.cardId, reversed: event.reversed }],
        drawnAt: session.drawnAt ?? event.now,
      }
    }

    case 'reveal-card': {
      if (session.stage !== 'draw') return session
      if (session.revealed >= session.cards.length) return session

      const revealed = session.revealed + 1
      const complete =
        revealed === session.cards.length && session.cards.length === cardCount(session)
      return {
        ...session,
        revealed,
        stage: complete ? 'core' : 'draw',
      }
    }

    case 'back': {
      if (session.stage === 'confirm') {
        return { ...session, stage: 'question', notice: null, veto: null }
      }
      if (session.stage === 'spread') {
        return { ...session, stage: 'confirm', notice: null }
      }
      if (session.stage === 'draw') {
        return {
          ...session,
          ...resetDraw(session),
          stage: 'spread',
          blockedCards: [],
          notice: '已清空这次抽牌，重新选一个牌阵就可以再抽。',
        }
      }
      if (session.stage === 'core') {
        return {
          ...session,
          ...resetDraw(session),
          stage: 'confirm',
          answers: {},
          blockedCards: [],
          notice: '回到这一步会清空已经抽到的牌。',
        }
      }
      if (session.stage === 'reflect' || session.stage === 'personal') {
        return { ...session, stage: 'core', notice: null }
      }
      if (session.stage === 'finish') {
        return { ...session, stage: 'personal', notice: null }
      }
      return session
    }

    case 'answer': {
      const answers = { ...session.answers, [event.questionId]: event.optionId }
      return { ...session, answers }
    }

    case 'continue': {
      if (session.stage === 'core') return { ...session, stage: 'reflect' }
      if (session.stage === 'reflect') return { ...session, stage: 'personal' }
      if (session.stage === 'personal') return { ...session, stage: 'finish' }
      return session
    }

    case 'skip-reflection':
      return { ...session, answers: {}, stage: 'personal' }

    case 'restart': {
      const next = initialSession()
      return { ...next, spreadId: session.spreadId }
    }

    default:
      return session
  }
}

/** 会话恢复：坏数据直接回到初始状态，不抛错。 */
export function reviveSession(raw: unknown): Session {
  if (!raw || typeof raw !== 'object') return initialSession()
  const value = raw as Partial<Session>
  if (!value.stage || !STAGES.includes(value.stage)) return initialSession()

  const base = initialSession()
  const spread = getSpread(value.spreadId)
  const cards = reviveCards(value).slice(0, spread.positions.length)

  return {
    ...base,
    ...value,
    spreadId: spread.id,
    categoryId: getCategory(value.categoryId)?.id ?? null,
    cards,
    revealed: Math.min(Math.max(Number(value.revealed) || 0, 0), cards.length),
    answers: value.answers && typeof value.answers === 'object' ? value.answers : {},
    veto: value.veto ?? null,
    blockedCards: reviveBlockedCards(value),
  } as Session
}

function isDrawnCard(value: unknown): value is DrawnCard {
  if (!value || typeof value !== 'object') return false
  const card = value as Partial<DrawnCard>
  return typeof card.cardId === 'string' && typeof card.reversed === 'boolean'
}

/** 抽到的牌：老会话存的是 cardIds 数组，这里一并兼容，读到就当作正位。 */
function reviveCards(value: Partial<Session> & { cardIds?: unknown }): DrawnCard[] {
  if (Array.isArray(value.cards)) {
    return value.cards.filter(isDrawnCard)
  }
  if (Array.isArray(value.cardIds)) {
    return value.cardIds
      .filter((id): id is string => typeof id === 'string')
      .map((cardId) => ({ cardId, reversed: false }))
  }
  return []
}

function reviveBlockedCards(value: Partial<Session> & { blockedCardIds?: unknown }): DrawnCard[] {
  if (Array.isArray(value.blockedCards)) {
    return value.blockedCards.filter(isDrawnCard)
  }
  if (Array.isArray(value.blockedCardIds)) {
    return value.blockedCardIds
      .filter((id): id is string => typeof id === 'string')
      .map((cardId) => ({ cardId, reversed: false }))
  }
  return []
}
