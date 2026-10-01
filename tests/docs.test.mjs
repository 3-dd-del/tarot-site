import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')

async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

/** 收集仓库内所有 Markdown 文件。 */
async function markdownFiles() {
  const files = [path.join(root, 'README.md')]
  for (const name of await readdir(docsDir)) {
    if (name.endsWith('.md')) files.push(path.join(docsDir, name))
  }
  return files
}

const techDoc = await readFile(path.join(docsDir, 'tech-solution.md'), 'utf8')
const stepsDoc = await readFile(path.join(docsDir, 'reference-steps.md'), 'utf8')
const designDoc = await readFile(path.join(docsDir, 'product-design.md'), 'utf8')

describe('技术方案文档', () => {
  it('覆盖选型、结构、数据、实现、素材、性能与测试', () => {
    for (const heading of [
      '## 1. 技术选型',
      '## 2. 系统结构',
      '## 3. 数据层',
      '## 4. 关键实现',
      '## 5. 牌面素材管线',
      '## 6. 性能预算',
      '## 7. 测试策略',
      '## 8. 部署',
      '## 9. 风险清单',
    ]) {
      assert.ok(techDoc.includes(heading), `技术方案缺少小节：${heading}`)
    }
  })

  it('选型与产品设计文档保持一致', () => {
    assert.match(techDoc, /\| 框架 \| Astro \|/)
    assert.match(techDoc, /public\/img\/cards\//)
    assert.match(techDoc, /image-sources\.md/)
  })
})

describe('参考步骤文档', () => {
  it('覆盖建站、桌面入口与图标三件事', () => {
    for (const heading of [
      '## 1. 建站与运行（Astro）',
      '## 2. 选择在哪里打开',
      '## 3. 创建桌面快捷方式',
      '## 4. 换图标',
    ]) {
      assert.ok(stepsDoc.includes(heading), `参考步骤缺少小节：${heading}`)
    }
    assert.match(stepsDoc, /pnpm build/)
    assert.match(stepsDoc, /cloudflare/i)
    assert.match(stepsDoc, /create-shortcut\.ps1/)
    assert.match(stepsDoc, /serve\.ps1/)
  })

  it('桌面入口用到的文件都真实存在', async () => {
    for (const file of [
      '启动塔罗牌.bat',
      'scripts/serve.ps1',
      'scripts/create-shortcut.ps1',
      'scripts/make-icon.mjs',
      'assets/tarot.ico',
      'public/favicon.ico',
      'public/site.webmanifest',
      'public/sw.js',
    ]) {
      assert.ok(await exists(path.join(root, file)), `缺少文件：${file}`)
    }
  })

  it('README 说明了本地运行与桌面快捷方式', async () => {
    const readme = await readFile(path.join(root, 'README.md'), 'utf8')
    assert.match(readme, /pnpm dev/)
    assert.match(readme, /pnpm verify/)
    assert.match(readme, /create-shortcut\.ps1/)
  })

  it('第 7 节记录了牌阵改造方案，并标明尚未实施', () => {
    assert.ok(
      stepsDoc.includes('## 7. 下一步改造：牌阵与多张牌的顺序（尚未实施）'),
      '参考步骤缺少牌阵改造小节',
    )
    for (const marker of ['牌位', '顺序', 'src/lib/spreads.ts', '关系层', '528 条']) {
      assert.ok(stepsDoc.includes(marker), `牌阵改造方案缺少：${marker}`)
    }
    assert.match(stepsDoc, /按问题类型自动推荐/)
    assert.match(stepsDoc, /翻牌顺序不改变抽到的牌/)
  })
})

describe('产品设计文档 · 占卜方法与用户旅程', () => {
  it('收录占卜方法论与用户旅程的全部小节', () => {
    for (const heading of [
      '## 11. 占卜方法论',
      '### 11.1 提问规则：整个产品的第一道闸门',
      '### 11.2 洗牌、切牌、抽牌：三件不能省的事',
      '### 11.3 牌阵：一个问题需要几个角度',
      '### 11.4 解牌五步',
      '### 11.5 语气与边界',
      '### 11.6 复盘：让解读可以被验证',
      '## 12. 用户视角：一次完整的游玩',
    ]) {
      assert.ok(designDoc.includes(heading), `产品设计文档缺少小节：${heading}`)
    }
  })

  it('提问规则给出四条要求与转译对照', () => {
    for (const marker of [
      '聚焦自己',
      '开放',
      '有行动空间',
      '不窥探第三方',
      '同一个问题当天只抽一次',
    ]) {
      assert.ok(designDoc.includes(marker), `提问规则缺少：${marker}`)
    }
    assert.match(designDoc, /我今年会不会被裁/)
    assert.match(designDoc, /这份投资会不会赚/)
  })

  it('牌阵一节给出三个牌阵与各自牌位', () => {
    for (const marker of [
      '单张牌',
      '时间流',
      '处境',
      '过去 · 现在 · 未来',
      '现状 · 阻碍 · 建议',
      '凯尔特十字（十张）不做',
    ]) {
      assert.ok(designDoc.includes(marker), `牌阵一节缺少：${marker}`)
    }
  })

  it('用户旅程逐拍覆盖主流程的每一步', () => {
    for (let step = 0; step <= 7; step += 1) {
      assert.ok(designDoc.includes(`拍 ${step}`), `用户旅程缺少：拍 ${step}`)
    }
    assert.ok(designDoc.includes('拍 2.5｜选牌阵'), '用户旅程缺少选牌阵这一拍')
  })

  it('旅程里抽到的那张牌真实存在，且牌位口径与牌义页一致', async () => {
    assert.match(designDoc, /宝剑八 · 正位/)
    const card = await readFile(path.join(root, 'src', 'content', 'cards', 'swords-08.mdx'), 'utf8')
    assert.match(card, /name: 宝剑八/)
    assert.ok(designDoc.includes('这张牌不意味着什么'), '旅程应提到「不意味着什么」小节')
  })
})

describe('文档链接', () => {
  it('所有相对链接都能指向真实文件', async () => {
    const broken = []
    for (const file of await markdownFiles()) {
      const text = await readFile(file, 'utf8')
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = match[1]
        if (/^(https?:|mailto:|#)/.test(target)) continue
        const clean = decodeURIComponent(target.split('#')[0])
        if (!clean) continue
        const candidates = [
          path.resolve(path.dirname(file), clean),
          path.resolve(root, clean),
        ]
        if (!(await Promise.all(candidates.map(exists))).some(Boolean)) {
          broken.push(`${path.relative(root, file)} -> ${target}`)
        }
      }
    }
    assert.deepEqual(broken, [])
  })
})
