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
