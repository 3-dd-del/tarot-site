/**
 * 抽牌主流程的客户端脚本（技术方案 2.3：只有需要用户输入和随机性的部分上 JS）。
 * 状态全部由 src/lib/machine.ts 的纯函数计算，这里只负责呈现与持久化。
 */

import {
  confirmedQuestion,
  initialSession,
  questionKey,
  reduce,
  reviveSession,
  type DrawRecord,
  type Session,
} from '../lib/machine'
import { CATEGORIES, FREE_DRAW_LABEL, getCategory, type CategoryId } from '../lib/questions'
import { isBlocked } from '../lib/taboo'
import { pickOne } from '../lib/random'
import { buildCoreReading, buildPersonalReading, type ReadingCard } from '../lib/reading'
import { reflectQuestions } from '../lib/reflect'
import {
  SHARE_VARIANTS,
  buildShareContent,
  downloadBlob,
  renderShareImage,
  type ShareVariant,
} from '../lib/share'

const SESSION_KEY = 'tarot:session'
const DRAWS_KEY = 'tarot:draws'
const SHUFFLE_MS = 1500

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
  let lastReading: { core: string; advice: string; question: string } | null = null

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

  function cardById(list: ReadingCard[], id: string | null): ReadingCard | undefined {
    return id ? list.find((card) => card.id === id) : undefined
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
          确认，开始抽牌
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

  function cardBack(): string {
    return `
      <div class="relative h-72 w-48">
        <div class="absolute inset-0 -rotate-6 rounded-2xl border border-[var(--color-night-line)] bg-[var(--color-night-soft)]"></div>
        <div class="absolute inset-0 rotate-3 rounded-2xl border border-[var(--color-gold)]/50 bg-[var(--color-night-soft)]"></div>
        <div class="absolute inset-0 grid place-items-center rounded-2xl border border-[var(--color-gold)]/40 bg-[color-mix(in_oklab,var(--color-night-soft)_92%,black)] text-3xl text-[var(--color-gold)]">
          ✦
        </div>
      </div>
    `
  }

  function renderDraw() {
    const blockedCard = session.blockedCardId
    stepNode('draw').innerHTML = `
      <div class="panel text-center" data-draw-panel>
        <p class="text-sm text-[var(--color-muted)]" data-draw-status>
          ${blockedCard ? '你已经为这个问题抽过牌了' : '正在为你展开牌面…'}
        </p>
        <div class="mt-6 flex justify-center" data-deck>${cardBack()}</div>
        ${
          blockedCard
            ? `<div class="mt-6 flex flex-wrap justify-center gap-3">
                 <a class="btn" href="/cards/${escapeHtml(blockedCard)}">看那天抽到的牌</a>
                 <button type="button" class="btn btn-primary" data-action="restart">换一个问题</button>
               </div>`
            : ''
        }
      </div>
    `
    if (!blockedCard) void runDrawAnimation()
  }

  async function runDrawAnimation() {
    const deck = stepNode('draw').querySelector<HTMLElement>('[data-deck]')
    const status = stepNode('draw').querySelector<HTMLElement>('[data-draw-status]')
    if (!deck) return

    let list: ReadingCard[]
    try {
      list = await loadCards()
    } catch {
      if (status) {
        status.textContent = '牌面数据没有加载成功，请检查网络后重试。'
      }
      return
    }

    const chosen = pickOne(list)
    const now = Date.now()
    const records = readDraws()
    const key = questionKey(session)

    // 抽牌结果在动画开始前就算好，动画只是把它呈现出来。
    const next = reduce(session, { type: 'draw', cardId: chosen.id, now, records })
    if (!next.cardId) {
      session = next
      saveSession()
      render()
      return
    }

    const reading = buildCoreReading(chosen, session.categoryId as CategoryId)
    const personal = buildPersonalReading({
      card: chosen,
      categoryId: session.categoryId as CategoryId,
      answers: {},
      userNote: session.userNote,
    })
    lastReading = {
      core: reading.paragraphs.join(''),
      advice: personal.advice,
      question: confirmedQuestion(session),
    }

    // 洗牌 1.5 秒：一左一右各一次，动作是仪式的一部分，不是进度条。
    deck.classList.add('anim-shuffle-left')
    await wait(SHUFFLE_MS / 2)
    deck.classList.remove('anim-shuffle-left')
    deck.classList.add('anim-shuffle-right')
    await wait(SHUFFLE_MS / 2)
    deck.classList.remove('anim-shuffle-right')
    if (status) status.textContent = '翻开这一张…'

    deck.innerHTML = `
      <figure class="anim-flip">
        <img
          src="${escapeHtml(chosen.image)}"
          alt="${escapeHtml(chosen.name)} ${escapeHtml(chosen.nameEn)}"
          width="800" height="1333"
          class="h-72 w-auto rounded-2xl border border-[var(--color-gold)]/60"
        />
        <figcaption class="mt-3 text-sm text-[var(--color-gold)]">${escapeHtml(chosen.name)}</figcaption>
      </figure>
    `

    saveDraws([...records, { questionKey: key, cardId: chosen.id, drawnAt: now }])
    await wait(900)

    session = next
    saveSession()
    render()
  }

  function renderCore() {
    const id = session.cardId
    if (!id) {
      apply({ type: 'back' })
      return
    }
    void loadCards().then((list) => {
      const card = cardById(list, id)
      if (!card) return
      const categoryId = session.categoryId as CategoryId
      const reading = buildCoreReading(card, categoryId)
      lastReading = lastReading ?? {
        core: reading.paragraphs.join(''),
        advice: buildPersonalReading({ card, categoryId, answers: {}, userNote: session.userNote })
          .advice,
        question: confirmedQuestion(session),
      }

      stepNode('core').innerHTML = `
        ${cardHeader(card)}
        <div class="prose-cn mt-5">
          <h2>画面</h2>
          <p>${escapeHtml(reading.paragraphs[0] ?? '')}</p>
          <h2>象征</h2>
          <p>${escapeHtml(reading.paragraphs[1] ?? '')}</p>
          <h2>放到你的问题里</h2>
          <p>${escapeHtml(reading.contextLayer)}</p>
        </div>
        <div class="mt-6 flex flex-wrap gap-3">
          <button type="button" class="btn" data-action="back">返回</button>
          <button type="button" class="btn btn-primary" data-action="continue">
            回答两个反思问题（可跳过）
          </button>
          <button type="button" class="btn btn-quiet" data-action="skip">跳过，直接看个性化解读</button>
        </div>
      `
    })
  }

  function cardHeader(card: ReadingCard): string {
    return `
      <div class="flex flex-col gap-4 sm:flex-row">
        <img
          src="${escapeHtml(card.image)}"
          alt="${escapeHtml(card.name)} ${escapeHtml(card.nameEn)}"
          width="800" height="1333"
          class="w-28 shrink-0 self-start rounded-xl border border-[var(--color-night-line)]"
        />
        <div>
          <p class="text-xs text-[var(--color-muted)]">你问的是</p>
          <p class="text-base">${escapeHtml(session.freeDraw ? '此刻我需要看见什么' : (session.userNote ? confirmedQuestion(session) : (getCategory(session.categoryId)?.questions.find((q) => q.id === session.questionId)?.label ?? '')))}</p>
          <h1 class="mt-3 text-2xl">${escapeHtml(card.name)}</h1>
          <p class="text-xs text-[var(--color-muted)]">${escapeHtml(card.nameEn)}</p>
          <p class="mt-2 text-xs text-[var(--color-gold)]">${card.keywords.map(escapeHtml).join(' · ')}</p>
        </div>
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
        第 ${reflectIndex + 1} / ${questions.length} 题。你的回答只改变建议的落点，不会改变这张牌指向的方向。
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
    const id = session.cardId
    if (!id) return
    void loadCards().then((list) => {
      const card = cardById(list, id)
      if (!card) return
      const categoryId = session.categoryId as CategoryId
      const personal = buildPersonalReading({
        card,
        categoryId,
        answers: session.answers,
        userNote: session.userNote,
      })
      const core = buildCoreReading(card, categoryId)
      lastReading = {
        core: core.paragraphs.join(''),
        advice: personal.advice,
        question: confirmedQuestion(session),
      }

      stepNode('personal').innerHTML = `
        <h1 class="text-2xl">把这张牌落回到你身上</h1>
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
    const id = session.cardId
    stepNode('finish').innerHTML = `
      <h1 class="text-2xl">到这一步，剩下的交给你</h1>
      <p class="mt-2 text-sm text-[var(--color-muted)]">
        图片在你的浏览器里现场生成，不会上传到服务器。
      </p>
      <div class="panel mt-5">
        <h2 class="text-base">保存这次解读</h2>
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
        ${id ? `<a class="btn" href="/cards/${escapeHtml(id)}">看这张牌的完整牌义</a>` : ''}
        <button type="button" class="btn" data-action="back">回到个性化解读</button>
        <button type="button" class="btn btn-primary" data-action="restart">换个问题再抽</button>
      </div>
    `
  }

  /* ---------- 分享 ---------- */

  async function saveShareImage(variant: ShareVariant, button: HTMLButtonElement) {
    const status = stepNode('finish').querySelector<HTMLElement>('[data-share-status]')
    const id = session.cardId
    if (!id || !lastReading) return
    const list = await loadCards()
    const card = cardById(list, id)
    if (!card) return

    button.disabled = true
    if (status) {
      status.classList.remove('hidden')
      status.textContent = '正在生成图片…'
    }

    try {
      const content = buildShareContent({
        cardId: card.id,
        cardName: card.name,
        cardNameEn: card.nameEn,
        cardImage: card.image,
        question: lastReading.question,
        coreReading: lastReading.core,
        advice: lastReading.advice,
      })
      const blob = await renderShareImage(content, variant)
      downloadBlob(blob, `塔罗-${card.id}-${variant}.png`)
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
      'button[data-category], button[data-question], button[data-action], button[data-answer], button[data-share], [data-free-draw]',
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

    if (target.hasAttribute('data-free-draw')) {
      apply({ type: 'start-free-draw' })
      prefetchCards()
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
        apply({ type: 'confirm' })
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
      '',
      lastReading.core,
      '',
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
  if (session.stage !== 'question') prefetchCards()
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
