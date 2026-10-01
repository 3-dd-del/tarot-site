/** Content Collections 到运行时数据结构的转换，页面与静态 JSON 共用。 */

import { getCollection, type CollectionEntry } from 'astro:content'

import { parseCardBody, validateSections } from './card-content'
import type { ReadingCard } from './reading'
import type { Suit } from './minor-rules'

export type CardEntry = CollectionEntry<'cards'>

/** 把一条内容记录转成解读层需要的数据，顺带做一次结构校验。 */
export function toReadingCard(entry: CardEntry): ReadingCard {
  const body = entry.body ?? ''
  const sections = parseCardBody(body, entry.data.id)
  validateSections(sections, entry.data.id, body, { arcana: entry.data.arcana })

  return {
    id: entry.data.id,
    name: entry.data.name,
    nameEn: entry.data.nameEn,
    arcana: entry.data.arcana,
    suit: (entry.data.suit as Suit | null) ?? null,
    number: entry.data.number,
    element: entry.data.element,
    keywords: entry.data.keywords,
    image: entry.data.image,
    sections,
  }
}

export interface CardSummary {
  id: string
  name: string
  nameEn: string
  arcana: 'major' | 'minor'
  suit: Suit | null
  number: number
  keywords: string[]
  image: string
}

export function toSummary(card: ReadingCard): CardSummary {
  return {
    id: card.id,
    name: card.name,
    nameEn: card.nameEn,
    arcana: card.arcana,
    suit: card.suit,
    number: card.number,
    keywords: card.keywords,
    image: card.image,
  }
}

const ORDER = [
  'major-00',
  'major-01',
  'major-02',
  'major-03',
  'major-04',
  'major-05',
  'major-06',
  'major-07',
  'major-08',
  'major-09',
  'major-10',
  'major-11',
  'major-12',
  'major-13',
  'major-14',
  'major-15',
  'major-16',
  'major-17',
  'major-18',
  'major-19',
  'major-20',
  'major-21',
]

function sortIndex(id: string): number {
  const majorIndex = ORDER.indexOf(id)
  if (majorIndex >= 0) return majorIndex
  const [suit, number] = id.split('-')
  const suitIndex = ['wands', 'cups', 'swords', 'pentacles'].indexOf(suit ?? '')
  return 22 + suitIndex * 14 + Number(number ?? 0)
}

export async function loadCards(): Promise<ReadingCard[]> {
  const entries = await getCollection('cards')
  return entries.map(toReadingCard).sort((a, b) => sortIndex(a.id) - sortIndex(b.id))
}
