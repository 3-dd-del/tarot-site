/**
 * 最小可用的 Service Worker：让「安装此站点为应用」在浏览器里可用。
 * 只做静态资源的缓存优先策略，不缓存 /data/ 与用户内容。
 */
const CACHE = 'tarot-shell-v3'
const SHELL = ['/', '/read', '/favicon.svg', '/site.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/data/')) return

  // 只有图片可以直接吃缓存：文件名和内容一一对应。
  // /_astro/ 下的文件名虽然也带哈希，但子路径部署会改写文件内容（见 scripts/prefix-dist.mjs），
  // 文件名不变而内容变了，所以那边一律先走网络——否则用户会一直拿着旧脚本。
  const cachedIfPresent = url.pathname.startsWith('/img/')

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cachedIfPresent && cached) return cached

      try {
        const response = await fetch(request)
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      } catch (error) {
        if (cached) return cached
        throw error
      }
    })(),
  )
})
