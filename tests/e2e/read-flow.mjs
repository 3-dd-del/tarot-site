/**
 * 端到端：把构建产物里的抽牌页真的跑一遍。
 *
 * 为什么要这一层：冒烟测试只检查 HTML 里有没有脚本标签，检查不出「脚本加载了但根本跑不起来」
 * ——线上就因为子路径改写误伤了正则字面量，整页点不动，而所有单测和冒烟都是绿的。
 * 这个用例把 dist/read/index.html 与真实的客户端 bundle 放进 jsdom，从选问题一路点到收尾。
 *
 * 依赖构建产物，所以跑之前要先 pnpm build（pnpm verify 里就是先构建再跑它）。
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { JSDOM } from 'jsdom'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const dist = path.join(root, 'dist')

function click(window, element) {
  assert.ok(element, '要点击的元素不存在')
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
}

function findByText(document, selector, text) {
  return [...document.querySelectorAll(selector)].find((el) => (el.textContent ?? '').includes(text))
}

async function waitFor(check, message, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = check()
    if (value) return value
    if (Date.now() > deadline) throw new Error(`等待超时：${message}`)
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
}

/** 把抽牌页加载进 jsdom，并手动执行真实的客户端 bundle。 */
async function loadApp() {
  const html = await readFile(path.join(dist, 'read', 'index.html'), 'utf8')
  const bundleSrc = html.match(/src="(\/_astro\/[^"]+\.js)"/)?.[1]
  assert.ok(bundleSrc, '构建产物里找不到抽牌岛的脚本')
  const bundle = await readFile(path.join(dist, bundleSrc.replace(/^\//, '')), 'utf8')

  // outside-only：页面自身的 <script> 不执行（jsdom 不支持 ESM），下面用 window.eval 手动跑
  const dom = new JSDOM(html, { url: 'http://localhost/read/', runScripts: 'outside-only' })
  const { window } = dom

  window.scrollTo = () => {}
  window.fetch = async (url) => {
    const rel = String(url).replace(/^\/+/, '').split('?')[0]
    const text = await readFile(path.join(dist, rel), 'utf8')
    return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text }
  }

  window.eval(bundle)
  return window
}

function stageOf(window) {
  return window.document.querySelector('[data-read-app]')?.dataset.stage
}

function visibleText(window, step) {
  const node = window.document.querySelector(`[data-step="${step}"]`)
  return node ? (node.textContent ?? '').replace(/\s+/g, '') : ''
}

test('从选问题一路点到收尾，整条抽牌流程都能走通', { timeout: 120000 }, async () => {
  const window = await loadApp()
  const { document } = window

  assert.equal(stageOf(window), 'question', '页面应当停在选问题这一步')

  // 1. 选一个情感问题
  click(window, findByText(document, '[data-category]', '感情关系'))
  const questionBtn = await waitFor(
    () => findByText(document, '[data-question]', '我现在的这段关系'),
    '选完分类后应当出现二级问题',
  )
  click(window, questionBtn)
  assert.equal(stageOf(window), 'confirm')

  // 2. 确认问题，顺手补一句话
  const note = await waitFor(() => document.querySelector('[data-note]'), '确认步骤应当有补充输入框')
  note.value = '我其实很怕失去现在的稳定'
  note.dispatchEvent(new window.Event('input', { bubbles: true }))
  click(window, findByText(document, 'button[data-action="confirm"]', '确认'))
  assert.equal(stageOf(window), 'spread', '确认之后应当进入选牌阵')

  // 3. 选三张牌的处境牌阵
  const spread = await waitFor(() => document.querySelector('[data-spread="situation"]'), '牌阵选项没渲染')
  click(window, spread)
  assert.equal(stageOf(window), 'draw')

  // 4. 洗牌 → 逐张抽、逐张翻
  const shuffle = await waitFor(() => document.querySelector('[data-shuffle]'), '抽牌步骤没出现洗牌按钮')
  click(window, shuffle)
  for (let index = 0; index < 3; index += 1) {
    const pick = await waitFor(() => document.querySelector('[data-pick]'), `第 ${index + 1} 张的抽牌按钮没出现`)
    click(window, pick)
    const flip = await waitFor(() => document.querySelector('[data-flip]'), `第 ${index + 1} 张没能抽出来`)
    click(window, flip)
    await new Promise((resolve) => setTimeout(resolve, 900))
  }

  assert.equal(stageOf(window), 'core', '三张牌翻完应当进入核心解读')
  const core = visibleText(window, 'core')
  for (const marker of ['现状', '阻碍', '建议', '把这几张放在一起看']) {
    assert.ok(core.includes(marker), `核心解读里缺少：${marker}`)
  }

  // 抽到的牌真的被记下来了
  const saved = JSON.parse(window.sessionStorage.getItem('tarot:session'))
  assert.equal(saved.cards.length, 3, '会话里应当记着三张牌')
  assert.ok(
    saved.cards.every((card) => typeof card.cardId === 'string' && typeof card.reversed === 'boolean'),
    '每张牌都要带上正逆位',
  )

  // 5. 反思问答：每题点第一个选项
  click(window, findByText(document, 'button[data-action="continue"]', '回答两个反思问题'))
  assert.equal(stageOf(window), 'reflect')
  for (let step = 0; step < 2; step += 1) {
    const answer = await waitFor(() => document.querySelector('[data-answer]'), '反思问题没渲染')
    click(window, answer)
    await new Promise((resolve) => setTimeout(resolve, 60))
    if (stageOf(window) !== 'reflect') break
  }
  assert.equal(stageOf(window), 'personal', '答完反思问题应当进入个性化解读')

  const personal = visibleText(window, 'personal')
  assert.ok(personal.includes('可以试试'), '个性化解读应当给一句能执行的建议')
  assert.ok(personal.includes('我其实很怕失去现在的稳定'), '个性化解读应当回应你写的那句话')

  // 6. 收尾
  click(window, findByText(document, 'button[data-action="continue"]', '收尾'))
  assert.equal(stageOf(window), 'finish')
  const finish = visibleText(window, 'finish')
  for (const marker of ['保存这次解读', '复制解读文字', '换个问题再抽']) {
    assert.ok(finish.includes(marker), `收尾步骤缺少：${marker}`)
  }
  assert.ok(document.querySelector('[data-share="story"]'), '应当有保存竖版长图的按钮')
  assert.ok(document.querySelector('[data-share="square"]'), '应当有保存方图的按钮')

  window.close()
})
