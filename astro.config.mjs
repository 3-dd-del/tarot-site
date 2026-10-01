// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'

// 站点为纯静态输出，部署目标见 docs/tech-solution.md 第 8 节。
// 首屏 JS 只包含抽牌岛，静态页面为零脚本。
export default defineConfig({
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
})
