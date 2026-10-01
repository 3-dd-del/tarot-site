import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

/**
 * 牌数据：短字段在 frontmatter，成段文案在正文（产品设计文档 5.1、7.4）。
 * frontmatter 字段写错、缺项或类型不对，构建期直接失败。
 */
const cards = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/cards' }),
  schema: z.object({
    id: z.string().regex(/^(major-\d{2}|(wands|cups|swords|pentacles)-\d{2})$/, 'id 必须与图片命名规则一致'),
    name: z.string().min(1),
    nameEn: z.string().min(1),
    arcana: z.enum(['major', 'minor']),
    suit: z.enum(['wands', 'cups', 'swords', 'pentacles']).nullable(),
    number: z.number().int().min(0).max(21),
    element: z.enum(['air', 'fire', 'water', 'earth']),
    keywords: z.array(z.string().min(1)).min(2).max(6),
    image: z.string().regex(/^\/img\/cards\/[a-z]+-\d{2}\.webp$/, 'image 必须指向 /img/cards/*.webp'),
  }),
})

const learn = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/learn' }),
  schema: z.object({
    title: z.string().min(1),
    order: z.number().int().min(1),
    summary: z.string().min(1),
  }),
})

export const collections = { cards, learn }
