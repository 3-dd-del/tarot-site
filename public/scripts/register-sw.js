// 注册 Service Worker，让浏览器提供「安装此站点为应用」的入口。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 注册失败不影响正常浏览
    })
  })
}
