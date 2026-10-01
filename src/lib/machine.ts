/**
 * 抽牌主流程的状态机（产品设计文档 4、技术方案 4.1）。
 * 纯函数实现，与 DOM 解耦，可以直接用单测覆盖状态迁移。
 *
 * question → confirm → draw → core → reflect（可跳过）→ personal → finish
 */

import type { CategoryId } from './questions'
import { FREE_DRAW_ID, categoryOfQuestion, findQuestion, getCategory } from './questions'
import { evaluateQuestion, isBlocked, type TabooVerdict } from './taboo'

export const STAGES = [
  'question',
  'confirm',
  'draw',
  'core',
  'reflect',
  'personal',
  'finish',
] as const

export type Stage = (typeof STAGES)[number]

export interface DrawRecord {
  questionKey: string
  cardId: string
  drawnAt: number
}

export interface Session {
  stage: Stage
  categoryId: CategoryId | null
  questionId: string | null
  userNote: string
  freeDraw: boolean
  cardId: string | null
  drawnAt: number | null
  answers: Record<string, string>
  notice: string | null
  veto: TabooVerdict | null
  /** 翻牌后被拦下的“当天不可重抽”提示。 */
  blockedCardId: string | null
}

export function initialSession(): Session {
  return {
    stage: 'question',
    categoryId: null,
    questionId: null,
    userNote: '',
    freeDraw: false,
    cardId: null,
    drawnAt: null,
    answers: {},
    notice: null,
    veto: null,
    blockedCardId: null,
  }
}

export type SessionEvent =
  | { type: 'select-category'; categoryId: CategoryId }
  | { type: 'select-question'; questionId: string }
  | { type: 'start-free-draw' }
  | { type: 'set-note'; text: string }
  | { type: 'confirm' }
  | { type: 'back' }
  | { type: 'draw'; cardId: string; now: number; records: DrawRecord[] }
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
      return { ...session, stage: 'draw', notice: null }
    }

    case 'back': {
      if (session.stage === 'confirm') {
        return { ...session, stage: 'question', notice: null, veto: null }
      }
      if (session.stage === 'draw') {
        return {
          ...session,
          stage: 'confirm',
          cardId: null,
          drawnAt: null,
          notice: '已清空这次抽牌，确认好问题可以重新开始。',
        }
      }
      if (session.stage === 'core') {
        return {
          ...session,
          stage: 'confirm',
          cardId: null,
          drawnAt: null,
          answers: {},
          notice: '回到这一步会清空已经抽到的牌。',
        }
      }
      if (session.stage === 'reflect' || session.stage === 'personal') {
        return { ...session, stage: 'core', notice: null }
      }
      return session
    }

    case 'draw': {
      if (session.stage !== 'draw') return session
      const key = questionKey(session)
      const existing = findTodayRecord(event.records, key, event.now)
      if (existing) {
        return {
          ...session,
          blockedCardId: existing.cardId,
          cardId: null,
          notice: '你已经为这个问题抽过这张牌了，今天不再重抽。可以看看当时的结果，也可以换一个问题。',
        }
      }
      return {
        ...session,
        cardId: event.cardId,
        drawnAt: event.now,
        blockedCardId: null,
        notice: null,
        stage: 'core',
      }
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
      return { ...next, notice: session.notice }
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
  const categoryId = getCategory(value.categoryId)?.id ?? null
  return {
    ...initialSession(),
    ...value,
    categoryId,
    answers: value.answers && typeof value.answers === 'object' ? value.answers : {},
    veto: value.veto ?? null,
  } as Session
}
