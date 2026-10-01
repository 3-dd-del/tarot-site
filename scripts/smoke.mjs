/**
 * 构建产物冒烟测试：起一个只读 dist 的静态服务器，逐个请求关键页面并校验内容。
 * 这是端到端测试的轻量替代——不需要下载浏览器，但保证每个路由真的能访问、内容真的在。
 *
 * 用法：node scripts/smoke.mjs
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname)
  const candidates = [decoded]
  if (decoded.endsWith('/')) candidates.push(`${decoded}index.html`)
  else candidates.push(`${decoded}/index.html`)

  for (const candidate of candidates) {
    const target = path.join(DIST, candidate)
    if (!target.startsWith(DIST)) continue
    try {
      const info = await stat(target)
      if (info.isFile()) return target
    } catch {
      /* 试下一个候选 */
    }
  }
  return null
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const file = await resolveFile(url.pathname)
  if (!file) {
    response.statusCode = 404
    response.end('not found')
    return
  }
  response.setHeader('content-type', MIME[path.extname(file)] ?? 'application/octet-stream')
  response.end(await readFile(file))
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`

const checks = [
  { path: '/', expect: ['它不告诉你会发生什么', '今日一牌'] },
  { path: '/read/', expect: ['data-step="question"', 'data-step="finish"', '先选一个最贴近的问题'] },
  { path: '/cards/', expect: ['大阿卡纳', '星币', '/cards/major-00'] },
  { path: '/cards/major-00/', expect: ['愚者', '象征', '分场景含义', '这张牌不意味着什么'] },
  { path: '/cards/wands-01/', expect: ['权杖首牌', '分场景含义', '数字 1'] },
  { path: '/cards/cups-05/', expect: ['圣杯五', '小阿卡纳的场景解读'] },
  { path: '/learn/', expect: ['入门路径', '花色与四元素', '牌阵'] },
  { path: '/journey/', expect: ['愚者的旅程', '魔术师', '世界'] },
  { path: '/about/', expect: ['关于本站', '公有领域', '12356'] },
  { path: '/site.webmanifest', expect: ['塔罗牌', 'icon-512.png'] },
  { path: '/favicon.svg', expect: ['<svg'] },
]

const failures = []

for (const check of checks) {
  const response = await fetch(`${base}${check.path}`)
  const body = await response.text()
  if (response.status !== 200) {
    failures.push(`${check.path} 返回 ${response.status}`)
    continue
  }
  for (const marker of check.expect) {
    if (!body.includes(marker)) failures.push(`${check.path} 缺少内容：${marker}`)
  }
}

// 卡片数据：78 张齐全，大阿卡纳带 8 个场景，小阿卡纳走生成规则
const dataResponse = await fetch(`${base}/data/cards.json`)
const cards = await dataResponse.json()
if (!Array.isArray(cards) || cards.length !== 78) {
  failures.push(`/data/cards.json 应包含 78 张牌，实际 ${Array.isArray(cards) ? cards.length : '不是数组'}`)
} else {
  const major = cards.find((card) => card.id === 'major-00')
  const minor = cards.find((card) => card.id === 'wands-01')
  if (!major || Object.keys(major.sections.scenes ?? {}).length !== 8) {
    failures.push('大阿卡纳在数据文件里没有 8 个分场景含义')
  }
  if (!minor?.sections?.meaning) failures.push('小阿卡纳在数据文件里缺少通用含义')
  const payload = Buffer.byteLength(JSON.stringify(cards))
  if (payload > 900 * 1024) failures.push(`卡片数据 ${Math.round(payload / 1024)}KB，超出预算 900KB`)
}

// 抽牌页面必须真的挂上客户端脚本
const readHtml = await (await fetch(`${base}/read/`)).text()
if (!/<script type="module"[^>]*src="\/_astro\//.test(readHtml)) {
  failures.push('/read/ 没有挂上抽牌岛的客户端脚本')
}

// 静态页面不应该挂抽牌脚本
const cardsHtml = await (await fetch(`${base}/cards/major-00/`)).text()
if (/<script type="module"/.test(cardsHtml)) {
  failures.push('/cards/major-00/ 出现了多余的客户端脚本，静态页应当是零 JS')
}

server.close()

if (failures.length > 0) {
  console.error(`冒烟测试失败：\n${failures.map((item) => `  - ${item}`).join('\n')}`)
  process.exit(1)
}

console.log(`冒烟测试通过：${checks.length} 个路由 + 数据文件 + 脚本挂载检查`)
