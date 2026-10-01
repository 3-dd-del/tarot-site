/**
 * 最小可用的 Service Worker：让「安装此站点为应用」在浏览器里可用。
 * 只做静态资源的缓存优先策略，不缓存 /data/ 与用户内容。
 */
const CACHE = 'tarot-shell-v2'
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

  // 带内容哈希的静态资源可以长期复用；HTML 一律先走网络，避免用户看不到更新。
  const immutable = url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/img/')

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (immutable && cached) return cached

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
