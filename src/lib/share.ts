/**
 * 分享卡片出图（产品设计文档 3.5、技术方案 4.3）。
 * 全程在客户端用 Canvas 绘制，不上传服务器；竖版长图与方图共用一份布局代码，只切换画布参数。
 */

export const SHARE_VARIANTS = {
  story: { width: 1080, height: 1920, label: '竖版长图' },
  square: { width: 1080, height: 1080, label: '方图' },
} as const

export type ShareVariant = keyof typeof SHARE_VARIANTS

export const BRAND = '塔罗牌 · 自我觉察工具'

export interface ShareContent {
  cardId: string
  cardName: string
  cardNameEn: string
  cardImage: string
  question: string
  core: string
  advice: string
  brand: string
}

export interface ShareInput {
  cardId: string
  cardName: string
  cardNameEn: string
  cardImage: string
  question: string
  coreReading: string
  advice: string
}

/** 出图内容只保留牌面、问题、核心解读摘要与一句建议。 */
export function buildShareContent(input: ShareInput): ShareContent {
  return {
    cardId: input.cardId,
    cardName: input.cardName,
    cardNameEn: input.cardNameEn,
    cardImage: input.cardImage,
    question: input.question.trim(),
    core: input.coreReading.replace(/\s+/g, '').trim(),
    advice: input.advice.replace(/\s+/g, '').trim(),
    brand: BRAND,
  }
}

/**
 * 按像素宽度折行。中文逐字断行，遇到换行符直接分段。
 * measure 由调用方提供，方便在没有 Canvas 的环境里做单测。
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (candidate: string) => number,
): string[] {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    const chars = [...paragraph.trim()]
    if (chars.length === 0) continue

    let line = ''
    for (const char of chars) {
      const next = line + char
      if (line && measure(next) > maxWidth) {
        lines.push(line)
        line = char
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }

  return lines
}

/** 摘要：默认截到指定字数，避免出图文字溢出。 */
export function summarize(text: string, limit: number): string {
  const plain = text.replace(/\s+/g, '').trim()
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain
}

interface Layout {
  card: { x: number; y: number; w: number; h: number }
  titleSize: number
  bodySize: number
  margin: number
  brandY: number
}

function layoutFor(variant: ShareVariant, cardWidth: number): Layout {
  if (variant === 'square') {
    return {
      card: { x: (1080 - cardWidth) / 2, y: 70, w: cardWidth, h: (cardWidth * 1333) / 800 },
      titleSize: 40,
      bodySize: 30,
      margin: 80,
      brandY: 1010,
    }
  }

  return {
    card: { x: (1080 - cardWidth) / 2, y: 150, w: cardWidth, h: (cardWidth * 1333) / 800 },
    titleSize: 48,
    bodySize: 34,
    margin: 96,
    brandY: 1850,
  }
}

const CARD_WIDTH: Record<ShareVariant, number> = { story: 520, square: 300 }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`牌面图片加载失败：${src}`))
    image.src = src
  })
}

/**
 * 绘制分享图。
 * 字体走系统字体栈：拿不到中文字体时直接降级，图上仍保留站点标识（技术方案 4.3 的降级要求）。
 */
export async function renderShareImage(
  content: ShareContent,
  variant: ShareVariant,
): Promise<Blob> {
  const { width, height } = SHARE_VARIANTS[variant]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 导出')

  try {
    await document.fonts?.ready
  } catch {
    /* 字体接口不可用就继续，用系统字体渲染 */
  }

  const image = await loadImage(content.cardImage)
  const layout = layoutFor(variant, CARD_WIDTH[variant])

  const background = ctx.createLinearGradient(0, 0, width, height)
  background.addColorStop(0, '#0b0918')
  background.addColorStop(0.55, '#15122a')
  background.addColorStop(1, '#0b0918')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.shadowColor = 'rgba(216, 177, 107, 0.35)'
  ctx.shadowBlur = 40
  ctx.strokeStyle = '#d8b16b'
  ctx.lineWidth = 4
  const { x, y, w, h } = layout.card
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, 24)
  else ctx.rect(x, y, w, h)
  ctx.stroke()
  ctx.restore()
  ctx.drawImage(image, x, y, w, h)

  const fontStack =
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif'
  const maxWidth = width - layout.margin * 2

  let cursor = layout.card.y + layout.card.h + 70

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f1dcad'
  ctx.font = `600 ${layout.titleSize}px ${fontStack}`
  ctx.fillText(content.cardName, width / 2, cursor)

  cursor += 42
  ctx.fillStyle = '#a29dbe'
  ctx.font = `300 ${Math.round(layout.titleSize * 0.5)}px ${fontStack}`
  ctx.fillText(content.cardNameEn, width / 2, cursor)

  if (content.question) {
    cursor += Math.round(layout.bodySize * 2)
    ctx.fillStyle = '#d8b16b'
    ctx.font = `400 ${layout.bodySize - 4}px ${fontStack}`
    ctx.fillText(`你问的是：${summarize(content.question, 40)}`, width / 2, cursor)
  }

  cursor += Math.round(layout.bodySize * 1.9)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#e6e3f4'
  ctx.font = `400 ${layout.bodySize}px ${fontStack}`
  const lineHeight = Math.round(layout.bodySize * 1.7)
  for (const line of wrapText(summarize(content.core, 220), maxWidth, (text) =>
    ctx.measureText(text).width,
  )) {
    if (cursor > layout.brandY - lineHeight * 3) break
    ctx.fillText(line, layout.margin, cursor)
    cursor += lineHeight
  }

  cursor += 26
  ctx.fillStyle = '#f1dcad'
  ctx.font = `500 ${layout.bodySize}px ${fontStack}`
  for (const line of wrapText(`可以试试：${summarize(content.advice, 80)}`, maxWidth, (text) =>
    ctx.measureText(text).width,
  )) {
    if (cursor > layout.brandY - lineHeight) break
    ctx.fillText(line, layout.margin, cursor)
    cursor += lineHeight
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#a29dbe'
  ctx.font = `400 ${Math.round(layout.bodySize * 0.72)}px ${fontStack}`
  ctx.fillText(content.brand, width / 2, layout.brandY)
  ctx.fillText('解读是参考，不是结论', width / 2, layout.brandY + 40)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('导出图片失败'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
