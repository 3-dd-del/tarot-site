import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCardBody, parseCardFile, validateSections, type CardFrontmatter } from '../../src/lib/card-content'
import type { ReadingCard } from '../../src/lib/reading'

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

export const cardsDir = path.join(repoRoot, 'src', 'content', 'cards')

export interface LoadedCard {
  fileName: string
  data: CardFrontmatter
  body: string
  card: ReadingCard
}

/** 读取全部牌数据，顺便跑一遍结构校验——内容错误在这里就会暴露。 */
export async function loadCards(options: { validate?: boolean } = {}): Promise<LoadedCard[]> {
  const files = (await readdir(cardsDir)).filter((name) => name.endsWith('.mdx')).sort()
  const cards: LoadedCard[] = []

  for (const fileName of files) {
    const raw = await readFile(path.join(cardsDir, fileName), 'utf8')
    const { data, body } = parseCardFile(raw)
    const sections = parseCardBody(body, data.id)
    if (data.arcana === 'minor' && (options.validate ?? true)) {
      validateSections(sections, data.id, body, { arcana: data.arcana })
    }
    cards.push({
      fileName,
      data,
      body,
      card: {
        id: data.id,
        name: data.name,
        nameEn: data.nameEn,
        arcana: data.arcana,
        suit: (data.suit as ReadingCard['suit']) ?? null,
        number: data.number,
        element: data.element,
        keywords: data.keywords,
        image: data.image,
        sections,
      },
    })
  }

  return cards
}
