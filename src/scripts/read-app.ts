/**
 * 抽牌主流程的客户端脚本（技术方案 2.3：只有需要用户输入和随机性的部分上 JS）。
 * 状态全部由 src/lib/machine.ts 的纯函数计算，这里只负责呈现与持久化。
 *
 * 抽牌阶段是用户自己动手的部分：洗牌、按牌位一张张抽、一张张翻，
 * 走完整个牌阵才进入解读。牌面与正逆位在洗牌那一刻就算好，点击只是把它翻出来。
 */

import {
  cardCount,
  confirmedQuestion,
  questionKey,
  reduce,
  reviveSession,
  type DrawRecord,
  type Session,
} from '../lib/machine'
import { CATEGORIES, FREE_DRAW_LABEL, getCategory, type CategoryId } from '../lib/questions'
import { isBlocked } from '../lib/taboo'
import { cryptoRandomInt, shuffle } from '../lib/random'
import {
  buildCoreReading,
  buildPersonalReading,
  buildPositionReadings,
  buildSynthesis,
  focusDrawnCard,
  type PositionReading,
  type ReadingCard,
  type ReadingDrawnCard,
} from '../lib/reading'
import { REVERSAL_NOTE } from '../lib/reversal'
import { reflectQuestions } from '../lib/reflect'
import { SPREADS, getSpread, orientationLabel, type SpreadId } from '../lib/spreads'
import {
  SHARE_VARIANTS,
  buildShareContent,
  downloadBlob,
  renderShareImage,
  type ShareCard,
  type ShareVariant,
} from '../lib/share'

const SESSION_KEY = 'tarot:session'
const DRAWS_KEY = 'tarot:draws'
const SHUFFLE_MS = 1500
const FLIP_MS = 800

/** 逆位的出现方式：洗牌时随机倒转，和真实的一叠牌一样。 */
function drawOrientation(): boolean {
  return cryptoRandomInt(2) === 1
}

interface FinishReading {
  question: string
  spreadName: string
  cards: ShareCard[]
  core: string
  advice: string
  /** 复制用的逐张文字 */
  lines: string[]
}

const root = document.querySelector<HTMLElement>('[data-read-app]')

if (root) {
  start(root)
}

function start(app: HTMLElement) {
  const nodes = {
    notice: app.querySelector<HTMLElement>('[data-notice]')!,
    markers: [...app.querySelectorAll<HTMLElement>('[data-step-marker]')],
    steps: [...app.querySelectorAll<HTMLElement>('[data-step]')],
    categoryList: app.querySelector<HTMLElement>('[data-category-list]')!,
    questionPanel: app.querySelector<HTMLElement>('[data-question-panel]')!,
    questionList: app.querySelector<HTMLElement>('[data-question-list]')!,
  }

  let session: Session = reviveSession(readJSON(sessionStorage, SESSION_KEY))
  let cardsPromise: Promise<ReadingCard[]> | null = null
  let reflectIndex = 0
  let lastReading: FinishReading | null = null
  /** 洗干净没有：纯表现，刷新后重新洗一遍即可 */
  let shuffled = false
  /** 正在播放翻牌动画的那一张 */
  let flipping: number | null = null
  /** 抽牌阶段要显示牌面，缓存一份，避免每次重新拉数据 */
  const cardCache = new Map<string, ReadingCard>()

  /* ---------- 数据与持久化 ---------- */

  function loadCards(): Promise<ReadingCard[]> {
    if (!cardsPromise) {
      cardsPromise = fetch('/data/cards.json').then((response) => {
        if (!response.ok) throw new Error('牌面数据加载失败')
        return response.json() as Promise<ReadingCard[]>
      })
    }
    return cardsPromise
  }

  function prefetchCards() {
    void loadCards().catch(() => {
      cardsPromise = null
    })
  }

  function saveSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      /* 隐私模式下写不进去也不影响使用 */
    }
  }

  function readDraws(): DrawRecord[] {
    const value = readJSON(localStorage, DRAWS_KEY)
    return Array.isArray(value) ? (value as DrawRecord[]) : []
  }

  function saveDraws(records: DrawRecord[]) {
    try {
      localStorage.setItem(DRAWS_KEY, JSON.stringify(records.slice(-50)))
    } catch {
      /* 忽略 */
    }
  }

  /* ---------- 工具 ---------- */

  function escapeHtml(text: string): string {
    return text.replace(
      /[&<>"']/g,
      (char) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
    )
  }

  function apply(event: Parameters<typeof reduce>[1]) {
    session = reduce(session, event)
    saveSession()
    render()
  }

  function cardById(list: ReadingCard[], id: string | null | undefined): ReadingCard | undefined {
    return id ? list.find((card) => card.id === id) : undefined
  }

  function cacheCards(list: ReadingCard[]) {
    for (const card of list) cardCache.set(card.id, card)
  }

  /** 把 session 里抽到的牌配上牌面数据 */
  function resolveCards(list: ReadingCard[]): ReadingDrawnCard[] {
    return session.cards.flatMap((drawn) => {
      const card = cardById(list, drawn.cardId)
      return card ? [{ card, reversed: drawn.reversed }] : []
    })
  }

  function spreadName(): string {
    return getSpread(session.spreadId).name
  }

  /* ---------- 渲染 ---------- */

  function render() {
    // 便于冒烟检查与人工排查：当前步骤挂在根节点上。
    app.dataset.stage = session.stage
    for (const step of nodes.steps) {
      step.classList.toggle('hidden', step.dataset.step !== session.stage)
    }
    for (const marker of nodes.markers) {
      const active = marker.dataset.stepMarker === session.stage
      marker.classList.toggle('border-[var(--color-gold)]', active)
      marker.classList.toggle('text-[var(--color-ink)]', active)
    }

    if (session.notice) {
      nodes.notice.textContent = session.notice
      nodes.notice.classList.remove('hidden')
    } else {
      nodes.notice.classList.add('hidden')
    }

    switch (session.stage) {
      case 'question':
        nodes.categoryList.classList.remove('hidden')
        nodes.questionPanel.classList.add('hidden')
        break
      case 'confirm':
        renderConfirm()
        break
      case 'spread':
        renderSpread()
        break
      case 'draw':
        renderDraw()
        break
      case 'core':
        renderCore()
        break
      case 'reflect':
        renderReflect()
        break
      case 'personal':
        renderPersonal()
        break
      case 'finish':
        renderFinish()
        break
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function stepNode(name: string): HTMLElement {
    return nodes.steps.find((step) => step.dataset.step === name)!
  }

  function renderConfirm() {
    const category = getCategory(session.categoryId)
    const label = session.freeDraw
      ? '此刻我需要看见的是什么'
      : (category?.questions.find((question) => question.id === session.questionId)?.label ?? '')
    const veto = session.veto
    const blocked = veto ? isBlocked(veto) : false

    stepNode('confirm').innerHTML = `
      <h1 class="text-2xl">确认一下你要问的问题</h1>
      <p class="mt-2 text-sm text-[var(--color-muted)]">
        牌只对已经确认的问题负责。你可以补一句自己的话，它会出现在解读里。
      </p>
      <div class="panel mt-5">
        <p class="text-lg">${escapeHtml(label)}</p>
        <p class="mt-1 text-xs text-[var(--color-muted)]">
          ${category ? escapeHtml(category.label) : '直接抽牌'}
        </p>
        <label class="mt-4 block text-sm">
          想补充一句自己的话吗（可选）
          <textarea
            data-note
            rows="2"
            maxlength="60"
            placeholder="例如：我其实很怕失去现在的稳定"
            class="mt-2 w-full rounded-xl border border-[var(--color-night-line)] bg-black/25 p-3 text-base text-[var(--color-ink)]"
          >${escapeHtml(session.userNote)}</textarea>
        </label>
      </div>
      <div data-veto>${veto && veto.level !== 'ok' ? renderVeto() : ''}</div>
      <div class="mt-5 flex flex-wrap gap-3">
        <button type="button" class="btn" data-action="back">返回</button>
        <button type="button" class="btn btn-primary" data-action="confirm" ${blocked ? 'disabled' : ''}>
          确认，接下来选牌阵
        </button>
      </div>
    `
  }

  /**
   * 输入时只重画提示区与确认按钮，不重建 textarea——
   * 重建会让中文输入法的候选状态被打断。
   */
  function updateVeto() {
    const node = stepNode('confirm')
    const slot = node.querySelector<HTMLElement>('[data-veto]')
    if (slot) slot.innerHTML = session.veto && session.veto.level !== 'ok' ? renderVeto() : ''
    const confirm = node.querySelector<HTMLButtonElement>('[data-action="confirm"]')
    if (confirm) confirm.disabled = session.veto ? isBlocked(session.veto) : false
  }

  function renderVeto(): string {
    const veto = session.veto!
    const resources = veto.resources.length
      ? `<ul class="mt-3 space-y-1 text-sm">${veto.resources
          .map(
            (item) =>
              `<li><span class="text-[var(--color-muted)]">${escapeHtml(item.label)}</span> <strong>${escapeHtml(item.value)}</strong></li>`,
          )
          .join('')}</ul>`
      : ''
    const rewrite = veto.rewrite
      ? `<button type="button" class="btn mt-3" data-action="use-rewrite" data-text="${escapeHtml(veto.rewrite)}">
           换成这个角度问：${escapeHtml(veto.rewrite)}
         </button>`
      : ''

    return `
      <div class="mt-5 rounded-xl border border-[color-mix(in_oklab,var(--color-rose)_50%,transparent)] bg-[color-mix(in_oklab,var(--color-rose)_10%,transparent)] p-4">
        <h2 class="text-base">${escapeHtml(veto.title)}</h2>
        <p class="mt-2 text-sm">${escapeHtml(veto.message)}</p>
        ${resources}
        ${rewrite}
      </div>
    `
  }

  function renderSpread() {
    stepNode('spread').innerHTML = `
      <h1 class="text-2xl">你想从几个角度看这件事</h1>
      <p class="mt-2 text-sm text-[var(--color-muted)]">
        牌阵决定抽几张牌、每张落在什么位置。第一次来，或者只想看清当下，选单张就够了。
      </p>
      <div class="mt-5 grid gap-3">
        ${SPREADS.map(
          (spread) => `
          <button type="button" class="panel text-left" data-spread="${spread.id}">
            <p class="text-base">
              ${escapeHtml(spread.name)}
              <span class="ml-1 text-xs text-[var(--color-muted)]">${spread.positions
                .map((position) => escapeHtml(position.label))
                .join(' · ')}</span>
            </p>
            <p class="mt-1 text-sm text-[var(--color-muted)]">${escapeHtml(spread.summary)}</p>
            <p class="mt-1 text-xs text-[var(--color-gold)]">适合：${escapeHtml(spread.bestFor)}</p>
          </button>
        `,
        ).join('')}
      </div>
      <div class="mt-5">
        <button type="button" class="btn" data-action="back">返回</button>
      </div>
    `
  }

  /* ---------- 抽牌：洗牌 → 逐张抽 → 逐张翻 ---------- */

  function cardBack(compact = false): string {
    const size = compact ? 'h-36 w-24' : 'h-56 w-36'
    return `
      <div class="relative ${size}">
        <div class="absolute inset-0 -rotate-6 rounded-2xl border border-[var(--color-night-line)] bg-[var(--color-night-soft)]"></div>
        <div class="absolute inset-0 rotate-3 rounded-2xl border border-[var(--color-gold)]/50 bg-[var(--color-night-soft)]"></div>
        <div class="absolute inset-0 grid place-items-center rounded-2xl border border-[var(--color-gold)]/40 bg-[color-mix(in_oklab,var(--color-night-soft)_92%,black)] text-2xl text-[var(--color-gold)]">
          ✦
        </div>
      </div>
    `
  }

  function faceUpCard(card: ReadingCard, reversed: boolean, extraClass = ''): string {
    return `
      <figure class="${extraClass}">
        <img
          src="${escapeHtml(card.image)}"
          alt="${escapeHtml(card.name)}${reversed ? '（逆位）' : ''}"
          width="800" height="1333"
          class="h-36 w-auto rounded-xl border border-[var(--color-gold)]/60 ${
            reversed ? 'rotate-180' : ''
          }"
        />
        <figcaption class="mt-2 text-center text-xs text-[var(--color-gold)]">
          ${escapeHtml(card.name)}${reversed ? ' · 逆位' : ''}
        </figcaption>
      </figure>
    `
  }

  function slotShell(inner: string, active: boolean): string {
    return `
      <div class="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed p-3 ${
        active ? 'border-[var(--color-gold)]/70' : 'border-[var(--color-night-line)]'
      }">
        ${inner}
      </div>
    `
  }

  function renderDraw() {
    const spread = getSpread(session.spreadId)
    const total = cardCount(session)

    if (session.blockedCards.length > 0) {
      stepNode('draw').innerHTML = `
        <div class="panel text-center">
          <p class="text-sm text-[var(--color-muted)]">你已经为这个问题抽过牌了</p>
          <div class="mt-5 flex flex-wrap justify-center gap-4">
            ${session.blockedCards
              .map((drawn, index) => {
                const label = spread.positions[index]?.label
                return `
                  <a class="no-underline" href="/cards/${escapeHtml(drawn.cardId)}">
                    <img
                      src="/img/cards/${escapeHtml(drawn.cardId)}.webp"
                      alt="那天抽到的牌"
                      width="800" height="1333"
                      class="h-40 w-auto rounded-xl border border-[var(--color-night-line)] ${
                        drawn.reversed ? 'rotate-180' : ''
                      }"
                    />
                    <span class="mt-2 block text-center text-xs text-[var(--color-muted)]">
                      ${label ? `${escapeHtml(label)} · ` : ''}${orientationLabel(drawn.reversed)}
                    </span>
                  </a>
                `
              })
              .join('')}
          </div>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" class="btn btn-primary" data-action="restart">换一个问题</button>
          </div>
        </div>
      `
      return
    }

    const picked = session.cards.length
    const revealed = session.revealed
    const mode =
      picked > revealed ? 'flip' : picked < total ? (shuffled ? 'pick' : 'shuffle') : 'done'
    const nextPosition = spread.positions[picked]

    const status =
      mode === 'shuffle'
        ? '先洗牌。洗的时候，把问题在心里再过一遍。'
        : mode === 'pick'
          ? `抽第 ${picked + 1} 张，它会落到「${nextPosition?.label ?? ''}」这个位置。`
          : mode === 'flip'
            ? '点一下把它翻开。'
            : '牌都翻开了。'

    const columns = total === 1 ? 'grid-cols-1' : total === 2 ? 'grid-cols-2' : 'grid-cols-3'

    stepNode('draw').innerHTML = `
      <div class="panel" data-draw-panel>
        <p class="text-sm text-[var(--color-muted)]" data-draw-status>${escapeHtml(status)}</p>
        <div class="mt-5 grid gap-3 ${columns}" data-slots>
          ${Array.from({ length: total }, (_, index) => {
            const position = spread.positions[index]!
            const drawn = session.cards[index]
            const faceUp = index < revealed || index === flipping
            if (drawn && faceUp) {
              const card = cardCache.get(drawn.cardId)
              return slotShell(
                card
                  ? faceUpCard(card, drawn.reversed, index === flipping ? 'anim-flip' : '')
                  : '<p class="text-xs text-[var(--color-muted)]">正在翻开…</p>',
                true,
              )
            }
            if (drawn) {
              return `<button type="button" class="block w-full text-left" data-flip="${index}">
                ${slotShell(
                  `${cardBack(true)}<p class="mt-1 text-center text-xs text-[var(--color-gold)]">点一下翻开</p>`,
                  true,
                )}
              </button>`
            }
            return slotShell(
              `<p class="text-xs text-[var(--color-gold)]">${escapeHtml(position.label)}</p>
               <p class="mt-1 text-center text-[11px] text-[var(--color-muted)]">${escapeHtml(position.prompt)}</p>`,
              index === picked,
            )
          }).join('')}
        </div>
        ${
          mode === 'shuffle'
            ? `<div class="mt-6 flex flex-col items-center gap-3">
                 <button type="button" class="btn btn-primary" data-shuffle>洗牌</button>
                 <div data-deck>${cardBack()}</div>
               </div>`
            : mode === 'pick'
              ? `<div class="mt-6 flex flex-col items-center gap-3">
                   <button type="button" class="btn btn-primary" data-pick>抽第 ${picked + 1} 张</button>
                   <div data-deck>${cardBack()}</div>
                 </div>`
              : ''
        }
      </div>
      <div class="mt-5">
        <button type="button" class="btn" data-action="back">返回，重新选牌阵</button>
      </div>
    `
  }

  async function runShuffle() {
    const deck = stepNode('draw').querySelector<HTMLElement>('[data-deck]')
    const status = stepNode('draw').querySelector<HTMLElement>('[data-draw-status]')
    if (status) status.textContent = '正在洗牌…'
    if (deck) {
      deck.classList.add('anim-shuffle-left')
      await wait(SHUFFLE_MS / 2)
      deck.classList.remove('anim-shuffle-left')
      deck.classList.add('anim-shuffle-right')
      await wait(SHUFFLE_MS / 2)
      deck.classList.remove('anim-shuffle-right')
    }
    shuffled = true
    renderDraw()
  }

  /** 抽下一张：牌面与正逆位在这之前就算好了。 */
  async function runPick() {
    let list: ReadingCard[]
    try {
      list = await loadCards()
    } catch {
      const status = stepNode('draw').querySelector<HTMLElement>('[data-draw-status]')
      if (status) status.textContent = '牌面数据没有加载成功，请检查网络后重试。'
      return
    }

    const taken = new Set(session.cards.map((card) => card.cardId))
    const card = shuffle(list.filter((item) => !taken.has(item.id)))[0]
    if (!card) return
    const reversed = drawOrientation()

    const deck = stepNode('draw').querySelector<HTMLElement>('[data-deck]')
    if (deck) {
      deck.classList.add('anim-shuffle-left')
      await wait(260)
      deck.classList.remove('anim-shuffle-left')
    }

    cardCache.set(card.id, card)
    apply({ type: 'pick-card', cardId: card.id, reversed, now: Date.now() })
  }

  async function runFlip(index: number) {
    flipping = index
    renderDraw()
    await wait(FLIP_MS)
    flipping = null

    const before = session.stage
    apply({ type: 'reveal-card' })

    // 走完整个牌阵，才落一条「今天抽过了」的记录。
    if (before !== 'core' && session.stage === 'core') {
      saveDraws([
        ...readDraws(),
        {
          questionKey: questionKey(session),
          cards: session.cards,
          drawnAt: session.drawnAt ?? Date.now(),
        },
      ])
    }
  }

  /* ---------- 解读 ---------- */

  function personalFor(drawn: ReadingDrawnCard[]) {
    const focus = focusDrawnCard(drawn, session.spreadId)
    const synthesis = buildSynthesis(drawn, session.spreadId)
    return buildPersonalReading({
      card: focus?.card ?? drawn[0]!.card,
      categoryId: session.categoryId as CategoryId,
      answers: session.answers,
      userNote: session.userNote,
      reversed: focus?.reversed ?? false,
      extra: synthesis.slice(0, 1),
    })
  }

  function renderCore() {
    void loadCards()
      .then((list) => {
        cacheCards(list)
        const drawn = resolveCards(list)
        if (drawn.length === 0) {
          apply({ type: 'back' })
          return
        }

        const categoryId = session.categoryId as CategoryId
        const spread = getSpread(session.spreadId)
        const positions = buildPositionReadings(drawn, session.spreadId, categoryId)
        const synthesis = buildSynthesis(drawn, session.spreadId)
        const hasReversed = drawn.some((item) => item.reversed)
        const personal = personalFor(drawn)

        lastReading = {
          question: confirmedQuestion(session),
          spreadName: spread.name,
          cards: drawn.map((item, index) => ({
            id: item.card.id,
            name: item.card.name,
            image: item.card.image,
            label: spread.positions[index]?.label ?? '',
            reversed: item.reversed,
          })),
          core: positions
            .map(
              (item) =>
                `${item.position.label}·${item.card.name}${item.reversed ? '（逆位）' : ''}：${item.imagery}${item.reversal ?? ''}${item.text}`,
            )
            .join(''),
          advice: personal.advice,
          lines: positions.map(
            (item) =>
              `${item.position.label}｜${item.card.name}（${orientationLabel(item.reversed)}）\n${item.imagery}\n${
                item.reversal ? `${item.reversal}\n` : ''
              }${item.text}`,
          ),
        }

        const body =
          positions.length === 1
            ? renderSingleCore(positions[0]!, categoryId)
            : renderSpreadCore(positions)

        stepNode('core').innerHTML = `
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-xs text-[var(--color-muted)]">你问的是</p>
              <p class="text-base">${escapeHtml(confirmedQuestion(session))}</p>
            </div>
            <p class="tag">${escapeHtml(spread.name)}</p>
          </div>
          ${body}
          ${
            synthesis.length
              ? `<div class="panel mt-5">
                   <h2 class="text-base text-[var(--color-gold-soft)]">把这几张放在一起看</h2>
                   ${synthesis.map((note) => `<p class="mt-2 text-sm">${escapeHtml(note)}</p>`).join('')}
                 </div>`
              : ''
          }
          ${
            hasReversed
              ? `<p class="mt-5 text-xs text-[var(--color-muted)]">
                   ${escapeHtml(REVERSAL_NOTE)}
                   <a class="underline decoration-dotted" href="/learn">再回教学页看看逆位</a>
                 </p>`
              : ''
          }
          <div class="mt-6 flex flex-wrap gap-3">
            <button type="button" class="btn" data-action="back">返回</button>
            <button type="button" class="btn btn-primary" data-action="continue">
              回答两个反思问题（可跳过）
            </button>
            <button type="button" class="btn btn-quiet" data-action="skip">跳过，直接看个性化解读</button>
          </div>
        `
      })
      .catch(() => {
        stepNode('core').innerHTML = `
          <p class="panel text-sm">牌面数据没有加载成功，请检查网络后刷新重试。</p>
        `
      })
  }

  function renderSingleCore(item: PositionReading, categoryId: CategoryId): string {
    const reading = buildCoreReading(item.card, categoryId, { reversed: item.reversed })
    return `
      <div class="mt-5 flex flex-col gap-4 sm:flex-row">
        <img
          src="${escapeHtml(item.card.image)}"
          alt="${escapeHtml(item.card.name)}${item.reversed ? '（逆位）' : ''}"
          width="800" height="1333"
          class="w-28 shrink-0 self-start rounded-xl border border-[var(--color-night-line)] ${
            item.reversed ? 'rotate-180' : ''
          }"
        />
        <div>
          <h1 class="text-2xl">${escapeHtml(item.card.name)}</h1>
          <p class="text-xs text-[var(--color-muted)]">${escapeHtml(item.card.nameEn)}</p>
          <p class="mt-1 text-xs text-[var(--color-gold)]">
            ${escapeHtml(orientationLabel(item.reversed))} ·
            ${item.card.keywords.map(escapeHtml).join(' · ')}
          </p>
        </div>
      </div>
      <div class="prose-cn mt-5">
        <h2>画面</h2>
        <p>${escapeHtml(reading.paragraphs[0] ?? '')}</p>
        <h2>象征</h2>
        <p>${escapeHtml(reading.paragraphs[1] ?? '')}</p>
        ${reading.reversalLayer ? `<h2>逆位</h2><p>${escapeHtml(reading.reversalLayer)}</p>` : ''}
        <h2>放到你的问题里</h2>
        <p>${escapeHtml(reading.contextLayer)}</p>
      </div>
    `
  }

  function renderSpreadCore(items: PositionReading[]): string {
    return `
      <div class="mt-5 space-y-4">
        ${items
          .map(
            (item) => `
            <article class="panel">
              <div class="flex gap-4">
                <img
                  src="${escapeHtml(item.card.image)}"
                  alt="${escapeHtml(item.card.name)}${item.reversed ? '（逆位）' : ''}"
                  width="800" height="1333"
                  class="w-20 shrink-0 self-start rounded-lg border border-[var(--color-night-line)] ${
                    item.reversed ? 'rotate-180' : ''
                  }"
                />
                <div>
                  <p class="text-xs text-[var(--color-gold)]">${escapeHtml(item.position.label)}</p>
                  <h2 class="text-lg">
                    ${escapeHtml(item.card.name)}
                    <span class="ml-1 text-xs text-[var(--color-muted)]">
                      ${escapeHtml(orientationLabel(item.reversed))}
                    </span>
                  </h2>
                  <p class="mt-1 text-xs text-[var(--color-muted)]">
                    ${escapeHtml(item.position.prompt)}
                  </p>
                </div>
              </div>
              <p class="mt-3 text-sm">${escapeHtml(item.imagery)}</p>
              ${
                item.reversal
                  ? `<p class="mt-2 text-sm text-[var(--color-gold-soft)]">${escapeHtml(item.reversal)}</p>`
                  : ''
              }
              <p class="mt-2 text-sm">${escapeHtml(item.text)}</p>
            </article>
          `,
          )
          .join('')}
      </div>
    `
  }

  function renderReflect() {
    const categoryId = session.categoryId as CategoryId
    const questions = reflectQuestions(categoryId)
    const node = stepNode('reflect')

    if (questions.length === 0 || reflectIndex >= questions.length) {
      apply({ type: 'continue' })
      return
    }

    const question = questions[reflectIndex]!
    node.innerHTML = `
      <h1 class="text-2xl">再问一句，能让解读更具体</h1>
      <p class="mt-2 text-sm text-[var(--color-muted)]">
        第 ${reflectIndex + 1} / ${questions.length} 题。你的回答只改变建议的落点，不会改变这几张牌指向的方向。
      </p>
      <div class="panel mt-5">
        <h2 class="text-lg">${escapeHtml(question.question)}</h2>
        <div class="mt-4 grid gap-2">
          ${question.options
            .map(
              (option) =>
                `<button type="button" class="btn justify-start text-left" data-answer="${escapeHtml(option.id)}">${escapeHtml(option.label)}</button>`,
            )
            .join('')}
        </div>
      </div>
      <button type="button" class="btn btn-quiet mt-4" data-action="skip">跳过反思问答</button>
    `
  }

  function renderPersonal() {
    void loadCards().then((list) => {
      cacheCards(list)
      const drawn = resolveCards(list)
      if (drawn.length === 0) return
      const personal = personalFor(drawn)

      stepNode('personal').innerHTML = `
        <h1 class="text-2xl">把这些牌落回到你身上</h1>
        <div class="prose-cn mt-4">
          ${personal.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
          <div class="panel mt-5">
            <h2 class="text-base">可以试试</h2>
            <p class="mt-1">${escapeHtml(personal.advice)}</p>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap gap-3">
          <button type="button" class="btn" data-action="back">返回核心解读</button>
          <button type="button" class="btn btn-primary" data-action="continue">收尾</button>
        </div>
      `
    })
  }

  function renderFinish() {
    stepNode('finish').innerHTML = `
      <h1 class="text-2xl">到这一步，剩下的交给你</h1>
      <p class="mt-2 text-sm text-[var(--color-muted)]">
        图片在你的浏览器里现场生成，不会上传到服务器。
      </p>
      <div class="panel mt-5">
        <h2 class="text-base">保存这次解读</h2>
        <p class="mt-1 text-xs text-[var(--color-muted)]">
          牌阵：${escapeHtml(spreadName())}
        </p>
        <div class="mt-3 flex flex-wrap gap-3">
          ${(Object.keys(SHARE_VARIANTS) as ShareVariant[])
            .map(
              (variant) =>
                `<button type="button" class="btn" data-share="${variant}">保存${SHARE_VARIANTS[variant].label}</button>`,
            )
            .join('')}
          <button type="button" class="btn btn-quiet" data-action="copy">复制解读文字</button>
        </div>
        <p class="mt-3 hidden text-sm" data-share-status></p>
      </div>
      <div class="mt-5 flex flex-wrap gap-3">
        ${session.cards
          .map(
            (drawn, index) =>
              `<a class="btn" href="/cards/${escapeHtml(drawn.cardId)}">看第 ${index + 1} 张的牌义</a>`,
          )
          .join('')}
        <button type="button" class="btn" data-action="back">回到个性化解读</button>
        <button type="button" class="btn btn-primary" data-action="restart">换个问题再抽</button>
      </div>
    `
  }

  /* ---------- 分享 ---------- */

  async function saveShareImage(variant: ShareVariant, button: HTMLButtonElement) {
    const status = stepNode('finish').querySelector<HTMLElement>('[data-share-status]')
    if (!lastReading) return

    button.disabled = true
    if (status) {
      status.classList.remove('hidden')
      status.textContent = '正在生成图片…'
    }

    try {
      const content = buildShareContent({
        cards: lastReading.cards,
        spreadName: lastReading.spreadName,
        question: lastReading.question,
        coreReading: lastReading.core,
        advice: lastReading.advice,
      })
      const blob = await renderShareImage(content, variant)
      downloadBlob(blob, `塔罗-${session.spreadId}-${variant}.png`)
      if (status) status.textContent = '图片已生成，检查一下浏览器的下载。'
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof Error && error.message.includes('不支持')
            ? error.message
            : '图片生成失败，可以先把文字复制下来保存。'
      }
    } finally {
      button.disabled = false
    }
  }

  /* ---------- 事件 ---------- */

  app.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      'button[data-category], button[data-question], button[data-spread], button[data-action], button[data-answer], button[data-share], button[data-pick], button[data-shuffle], button[data-flip], [data-free-draw]',
    )
    if (!target) return

    if (target.dataset.category) {
      renderQuestionList(target.dataset.category as CategoryId)
      return
    }

    if (target.dataset.question) {
      apply({ type: 'select-question', questionId: target.dataset.question })
      prefetchCards()
      return
    }

    if (target.dataset.spread) {
      shuffled = false
      flipping = null
      apply({ type: 'choose-spread', spreadId: target.dataset.spread as SpreadId })
      void loadCards().catch(() => undefined)
      return
    }

    if (target.hasAttribute('data-free-draw')) {
      apply({ type: 'start-free-draw' })
      prefetchCards()
      return
    }

    if (target.hasAttribute('data-shuffle')) {
      void runShuffle()
      return
    }

    if (target.hasAttribute('data-pick')) {
      void runPick()
      return
    }

    if (target.dataset.flip) {
      void runFlip(Number(target.dataset.flip))
      return
    }

    if (target.dataset.answer) {
      const categoryId = session.categoryId as CategoryId
      const question = reflectQuestions(categoryId)[reflectIndex]
      if (question) {
        session = reduce(session, {
          type: 'answer',
          questionId: question.id,
          optionId: target.dataset.answer,
        })
        saveSession()
      }
      reflectIndex += 1
      if (reflectIndex >= reflectQuestions(categoryId).length) {
        session = reduce(session, { type: 'continue' })
        saveSession()
        render()
      } else {
        renderReflect()
      }
      return
    }

    if (target.dataset.share) {
      void saveShareImage(target.dataset.share as ShareVariant, target as HTMLButtonElement)
      return
    }

    switch (target.dataset.action) {
      case 'back-to-categories':
        nodes.categoryList.classList.remove('hidden')
        nodes.questionPanel.classList.add('hidden')
        return
      case 'back':
        apply({ type: 'back' })
        return
      case 'confirm':
        apply({ type: 'confirm', now: Date.now(), records: readDraws() })
        void loadCards().catch(() => undefined)
        return
      case 'continue':
        reflectIndex = 0
        apply({ type: 'continue' })
        return
      case 'skip':
        reflectIndex = 0
        apply({ type: 'skip-reflection' })
        return
      case 'restart':
        reflectIndex = 0
        lastReading = null
        shuffled = false
        flipping = null
        apply({ type: 'restart' })
        return
      case 'use-rewrite': {
        apply({ type: 'set-note', text: target.dataset.text ?? '' })
        return
      }
      case 'copy':
        void copyReading()
        return
    }
  })

  app.addEventListener('input', (event) => {
    const target = event.target as HTMLElement
    if (target.matches('[data-note]')) {
      session = reduce(session, { type: 'set-note', text: (target as HTMLTextAreaElement).value })
      saveSession()
      updateVeto()
    }
  })

  function renderQuestionList(categoryId: CategoryId) {
    const category = CATEGORIES.find((item) => item.id === categoryId)
    if (!category) return
    nodes.questionList.innerHTML = `
      <div>
        <h2 class="text-lg text-[var(--color-gold)]">${escapeHtml(category.label)}</h2>
        <div class="mt-3 grid gap-2">
          ${category.questions
            .map(
              (question) =>
                `<button type="button" class="btn justify-start text-left" data-question="${escapeHtml(question.id)}">${escapeHtml(question.label)}</button>`,
            )
            .join('')}
        </div>
      </div>
    `
    nodes.categoryList.classList.add('hidden')
    nodes.questionPanel.classList.remove('hidden')
  }

  async function copyReading() {
    const status = stepNode('finish').querySelector<HTMLElement>('[data-share-status]')
    const report = (message: string) => {
      if (!status) return
      status.classList.remove('hidden')
      status.textContent = message
    }

    if (!lastReading) {
      report('这次解读还没有生成完，稍后再试一次。')
      return
    }

    const text = [
      `我抽到的是：${lastReading.question}`,
      `牌阵：${lastReading.spreadName}`,
      '',
      ...lastReading.lines.flatMap((line) => [line, '']),
      `可以试试：${lastReading.advice}`,
      '',
      '—— 解读是参考，不是结论。',
    ].join('\n')

    const copied = await writeClipboard(text)
    report(copied ? '解读文字已复制。' : '这个浏览器不允许自动复制，可以直接选中页面上的文字。')
  }

  function refreshFreeDrawLabel() {
    const button = app.querySelector<HTMLElement>('[data-free-draw]')
    if (button) button.textContent = FREE_DRAW_LABEL
  }

  refreshFreeDrawLabel()
  render()
  // 刷新后回到中间的某一步：先把牌面数据补进缓存，再重画一次。
  if (session.stage !== 'question') {
    void loadCards()
      .then((list) => {
        cacheCards(list)
        render()
      })
      .catch(() => {
        cardsPromise = null
      })
  }
}

function readJSON(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 复制文本。
 * 剪贴板 API 在部分浏览器里会一直挂着不 resolve，所以加超时，失败再退回 execCommand。
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(text),
        wait(1200).then(() => Promise.reject(new Error('clipboard timeout'))),
      ])
      return true
    }
  } catch {
    /* 继续走降级方案 */
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    document.body.append(area)
    area.select()
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false
    area.remove()
    return ok
  } catch {
    return false
  }
}
