/**
 * 给构建产物里的根路径加上前缀，供 GitHub Pages 这类子路径部署使用。
 *
 * 站点源码里的链接都写成根路径（/_astro/…、/img/…、/read、/data/cards.json），
 * 自托管在根目录时这是对的；但 GitHub Pages 的项目站点挂在 /<repo>/ 下面，
 * 根路径会全部 404。这个脚本在构建之后扫一遍 dist，把「以 / 开头、且不是 // 协议相对」
 * 的路径统一加上前缀。源文件与本地构建完全不受影响。
 *
 * 用法：node scripts/prefix-dist.mjs /tarot-site
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TEXT_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.txt',
  '.xml',
])

/**
 * 纯函数，便于单测。
 * 只改「前面是引号、反引号或左括号」的根路径：
 *   href="/read"      → href="/tarot-site/read"
 *   `/cards/${id}`    → `/tarot-site/cards/${id}`
 *   url(/img/a.webp)  → url(/tarot-site/img/a.webp)
 * 协议相对的 //cdn…、http(s)://、以及 </script> 这类都不动。
 */
export function prefixUrls(text, base) {
  const prefix = String(base ?? '').replace(/\/+$/, '')
  if (!prefix) return text
  return text.replace(/(["'`(])\/(?!\/)/g, `$1${prefix}/`)
}

/** 递归改写一个目录下的文本产物，返回被改过的文件。 */
export async function prefixDirectory(root, base) {
  const changed = []

  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      changed.push(...(await prefixDirectory(full, base)))
      continue
    }
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue

    const text = await readFile(full, 'utf8')
    const next = prefixUrls(text, base)
    if (next !== text) {
      await writeFile(full, next, 'utf8')
      changed.push(full)
    }
  }

  return changed
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const base = process.argv[2]
  if (!base || !base.startsWith('/')) {
    console.error('用法：node scripts/prefix-dist.mjs /tarot-site')
    process.exit(1)
  }

  const dist = path.resolve(import.meta.dirname, '..', 'dist')
  const changed = await prefixDirectory(dist, base)
  console.log(`已把 ${changed.length} 个文件里的根路径改写为 ${base.replace(/\/+$/, '')}/ 前缀`)
}
