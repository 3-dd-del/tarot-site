/**
 * 牌面文案的解析与结构校验。
 * frontmatter 只放短字段，成段文案在正文，按固定小节、固定顺序读取（产品设计文档 5.1、7.4）。
 * 结构错误在这里直接抛错，让构建失败，而不是等到上线后才发现某个页面缺一块。
 */

import { CATEGORIES, type CategoryId } from './questions'

export const SECTION_IMAGERY = '画面'
export const SECTION_SYMBOLISM = '象征'
export const SECTION_MEANING = '通用含义'
export const SECTION_NOT_MEANS = '这张牌不意味着什么'
export const SECTION_SCENES = '分场景含义'
export const SECTION_REFLECTION = '反思问题'

/** 大阿卡纳必须齐全；小阿卡纳是简化版，允许省略象征与「不意味着什么」。 */
export const MAJOR_REQUIRED_SECTIONS = [
  SECTION_IMAGERY,
  SECTION_SYMBOLISM,
  SECTION_MEANING,
  SECTION_NOT_MEANS,
  SECTION_SCENES,
  SECTION_REFLECTION,
] as const

export const MINOR_REQUIRED_SECTIONS = [
  SECTION_IMAGERY,
  SECTION_MEANING,
  SECTION_REFLECTION,
] as const

export interface CardSections {
  imagery: string
  symbolism: string
  meaning: string
  notMeans: string
  scenes: Partial<Record<CategoryId, string>>
  reflection: string[]
}

const CATEGORY_BY_LABEL = new Map(CATEGORIES.map((category) => [category.label, category.id]))

export const SECTION_ORDER = [
  SECTION_IMAGERY,
  SECTION_SYMBOLISM,
  SECTION_MEANING,
  SECTION_NOT_MEANS,
  SECTION_SCENES,
  SECTION_REFLECTION,
] as const

function clean(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function parseList(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+[.、]\s*/, '').trim())
    .filter(Boolean)
}

/**
 * 解析一张牌的 Markdown 正文。
 * @param body MDX 正文（不含 frontmatter）
 * @param id 牌 id，用于报错定位
 */
export function parseCardBody(body: string, id: string): CardSections {
  const sections = new Map<string, string[]>()
  const scenes = new Map<CategoryId, string[]>()
  const order: string[] = []

  let currentSection: string | null = null
  let currentScene: CategoryId | null = null

  const fail = (message: string): never => {
    throw new Error(`牌 ${id} 内容结构有误：${message}`)
  }

  for (const rawLine of body.split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(rawLine)
    const h3 = /^###\s+(.+?)\s*$/.exec(rawLine)

    if (h2) {
      currentSection = h2[1].trim()
      currentScene = null
      if (!sections.has(currentSection)) {
        sections.set(currentSection, [])
        order.push(currentSection)
      }
      continue
    }

    if (h3) {
      if (!currentSection) fail(`三级标题「${h3[1].trim()}」出现在任何二级小节之前`)
      if (currentSection !== SECTION_SCENES) {
        fail(`「${currentSection}」里不应出现三级标题「${h3[1].trim()}」`)
      }
      const label = h3[1].trim()
      const categoryId = CATEGORY_BY_LABEL.get(label)
      if (!categoryId) fail(`分场景含义里的「${label}」不是合法的一级问题分类`)
      currentScene = categoryId ?? null
      if (!scenes.has(categoryId!)) scenes.set(categoryId!, [])
      continue
    }

    if (!currentSection) continue
    if (currentSection === SECTION_SCENES) {
      if (!currentScene) continue
      scenes.get(currentScene)!.push(rawLine)
    } else {
      sections.get(currentSection)!.push(rawLine)
    }
  }

  return {
    imagery: clean(sections.get(SECTION_IMAGERY) ?? []),
    symbolism: clean(sections.get(SECTION_SYMBOLISM) ?? []),
    meaning: clean(sections.get(SECTION_MEANING) ?? []),
    notMeans: clean(sections.get(SECTION_NOT_MEANS) ?? []),
    scenes: Object.fromEntries(
      [...scenes.entries()].map(([categoryId, lines]) => [categoryId, clean(lines)]),
    ) as Partial<Record<CategoryId, string>>,
    reflection: parseList(sections.get(SECTION_REFLECTION) ?? []),
  }
}

export interface ValidateOptions {
  arcana: 'major' | 'minor'
}

export interface CardFrontmatter {
  id: string
  name: string
  nameEn: string
  arcana: 'major' | 'minor'
  suit: string | null
  number: number
  element: string
  keywords: string[]
  image: string
}

function parseScalar(raw: string): unknown {
  const value = raw.trim()
  if (value === 'null' || value === '~' || value === '') return null
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (/^-?\d+$/.test(value)) return Number(value)
  return value.replace(/^["']|["']$/g, '')
}

/**
 * 拆分 frontmatter 与正文的极简解析器，不做完整 YAML。
 * 内容文件只用简单的键值对与行内数组，够用就好；构建期校验真正依赖它。
 */
export function parseCardFile(raw: string): { data: CardFrontmatter; body: string } {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    throw new Error('内容文件缺少 frontmatter')
  }
  const end = normalized.indexOf('\n---', 3)
  if (end === -1) {
    throw new Error('内容文件的 frontmatter 没有闭合')
  }

  const head = normalized.slice(4, end)
  const body = normalized.slice(end + 4).replace(/^\n+/, '')

  const data: Record<string, unknown> = {}
  for (const line of head.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    data[key] = parseScalar(line.slice(separator + 1))
  }

  return { data: data as unknown as CardFrontmatter, body }
}

/** 校验小节是否齐全、顺序是否正确、场景是否覆盖全部一级分类。 */
export function validateSections(
  sections: CardSections,
  id: string,
  body: string,
  options: ValidateOptions,
): void {
  const required =
    options.arcana === 'major' ? MAJOR_REQUIRED_SECTIONS : MINOR_REQUIRED_SECTIONS

  const present = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].trim())
  const missing = required.filter((heading) => !present.includes(heading))
  if (missing.length > 0) {
    throw new Error(`牌 ${id} 缺少小节：${missing.join('、')}`)
  }

  const ordered = present.filter((heading) =>
    (SECTION_ORDER as readonly string[]).includes(heading),
  )
  const expectedOrder = (SECTION_ORDER as readonly string[]).filter((heading) =>
    ordered.includes(heading),
  )
  if (ordered.join('>') !== expectedOrder.join('>')) {
    throw new Error(
      `牌 ${id} 小节顺序不符合模板：实际为 ${ordered.join('、')}，应为 ${expectedOrder.join('、')}`,
    )
  }

  if (options.arcana === 'major') {
    const missingScenes = CATEGORIES.filter((category) => !sections.scenes[category.id]).map(
      (category) => category.label,
    )
    if (missingScenes.length > 0) {
      throw new Error(`牌 ${id} 的分场景含义缺少：${missingScenes.join('、')}`)
    }
  }

  if (sections.reflection.length === 0) {
    throw new Error(`牌 ${id} 的反思问题为空`)
  }
}
