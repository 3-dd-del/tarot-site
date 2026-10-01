/**
 * 给构建产物里的根路径加上前缀，供 GitHub Pages 这类子路径部署使用。
 *
 * 站点源码里的链接都写成根路径（/_astro/…、/img/…、/read、/data/cards.json），
 * 自托管在根目录时这是对的；但 GitHub Pages 的项目站点挂在 /<repo>/ 下面，
 * 根路径会全部 404。这个脚本在构建之后扫一遍 dist，把真实存在的站点路径加上前缀。
 * 源文件与本地构建完全不受影响。
 *
 * ⚠️ 这里必须用白名单。第一版脚本按「以 / 开头就改写」来做，把 JS 里的正则字面量
 * 也改了（`replace(/\s+/g, "")` 变成 `replace(/tarot-site/\s+/g, "")`），
 * 抽牌页的脚本直接语法报错、整页点不动。所以现在只认下面这份路径清单，
 * 并且写完会用 `node --check` 把每个脚本再解析一遍。
 *
 * 用法：node scripts/prefix-dist.mjs /tarot-site
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
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

/** 目录型路径：后面还会跟文件名，一律改写。 */
const ROOT_DIRS = ['/_astro/', '/img/', '/data/', '/scripts/']

/** 固定文件：整串必须完全一致。 */
const ROOT_FILES = new Set([
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/site.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/sw.js',
])

/** 页面路径：可以是它本身，也可以是它下面的一层。 */
const ROOT_PAGES = ['/cards', '/read', '/learn', '/journey', '/about']

/** 这个候选路径是不是站点里真实存在的根路径。 */
export function isRootPath(candidate) {
  if (candidate === '/') return true
  if (ROOT_DIRS.some((dir) => candidate.startsWith(dir))) return true
  if (ROOT_FILES.has(candidate)) return true
  return ROOT_PAGES.some((page) => candidate === page || candidate.startsWith(`${page}/`))
}

/**
 * 纯函数，便于单测。
 * 只改「前面是引号、反引号或左括号」且命中白名单的根路径：
 *   href="/read"        → href="/tarot-site/read"
 *   `/cards/${id}`      → `/tarot-site/cards/${id}`
 *   url(/img/a.webp)    → url(/tarot-site/img/a.webp)
 * 正则字面量（replace(/\s+/g, "")）、协议相对的 //cdn、http(s)://、</script> 都不动。
 */
export function prefixUrls(text, base) {
  const prefix = String(base ?? '').replace(/\/+$/, '')
  if (!prefix) return text

  return text.replace(/(["'`(])\/(?!\/)([^"'`)\s]*)/g, (match, lead, rest) => {
    const candidate = `/${rest}`
    if (!isRootPath(candidate)) return match
    if (candidate.startsWith(`${prefix}/`)) return match
    return `${lead}${prefix}${candidate}`
  })
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

/** 收集某个扩展名下的全部文件。 */
export async function collectFiles(root, extensions) {
  const found = []

  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await collectFiles(full, extensions)))
      continue
    }
    if (extensions.has(path.extname(entry.name))) found.push(full)
  }

  return found
}

/**
 * 语法自检：改写过的脚本必须还能被解析。
 * 构建产物是 ESM，用 .mjs 临时副本交给 node --check 判断。
 */
export function verifyJavaScript(files) {
  if (files.length === 0) return 0
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'tarot-prefix-'))
  try {
    for (const file of files) {
      const target = path.join(tmp, `${path.basename(file)}.mjs`)
      writeFileSync(target, readFileSync(file))
      execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' })
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return files.length
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
  const scripts = await collectFiles(dist, new Set(['.js', '.mjs']))
  const checked = verifyJavaScript(scripts)

  console.log(
    `已把 ${changed.length} 个文件里的根路径改写为 ${base.replace(/\/+$/, '')}/ 前缀；${checked} 个脚本语法自检通过`,
  )
}
