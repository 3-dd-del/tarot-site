/**
 * 分享卡片出图（产品设计文档 3.5、技术方案 4.3）。
 * 全程在客户端用 Canvas 绘制，不上传服务器；竖版长图与方图共用一份布局代码，只切换画布参数。
 * 单张与三张共用同一套布局：按张数自动选卡面宽度并居中。
 */

export const SHARE_VARIANTS = {
  story: { width: 1080, height: 1920, label: '竖版长图' },
  square: { width: 1080, height: 1080, label: '方图' },
} as const

export type ShareVariant = keyof typeof SHARE_VARIANTS

export const BRAND = '塔罗牌 · 自我觉察工具'

export interface ShareCard {
  id: string
  name: string
  image: string
  /** 牌位名，例如「过去」；单张牌时为空 */
  label: string
  /** 逆位的牌，出图时旋转 180° */
  reversed: boolean
}

export interface ShareContent {
  cards: ShareCard[]
  spreadName: string
  question: string
  core: string
  advice: string
  brand: string
}

export interface ShareInput {
  cards: ShareCard[]
  spreadName: string
  question: string
  coreReading: string
  advice: string
}

/** 出图内容只保留牌面、牌位、问题、核心解读摘要与一句建议。 */
export function buildShareContent(input: ShareInput): ShareContent {
  return {
    cards: input.cards.slice(0, 3).map((card) => ({
      id: card.id,
      name: card.name,
      image: card.image,
      label: card.label.trim(),
      reversed: card.reversed,
    })),
    spreadName: input.spreadName.trim(),
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

interface CardBox {
  x: number
  y: number
  w: number
  h: number
}

interface Layout {
  boxes: CardBox[]
  titleSize: number
  bodySize: number
  margin: number
  brandY: number
}

/** 1 张放大、2 张并排、3 张一字排开，三种尺寸都居中。 */
function layoutFor(variant: ShareVariant, count: number): Layout {
  const spec =
    variant === 'square'
      ? { y: 54, widths: [300, 250, 208], gap: 24, titleSize: 38, bodySize: 29, margin: 76, brandY: 1012 }
      : { y: 128, widths: [520, 396, 296], gap: 36, titleSize: 48, bodySize: 33, margin: 96, brandY: 1852 }

  const safeCount = Math.min(Math.max(count, 1), 3)
  const width = spec.widths[safeCount - 1]!
  const total = safeCount * width + (safeCount - 1) * spec.gap
  const startX = (1080 - total) / 2
  const height = (width * 1333) / 800

  return {
    boxes: Array.from({ length: safeCount }, (_, index) => ({
      x: startX + index * (width + spec.gap),
      y: spec.y,
      w: width,
      h: height,
    })),
    titleSize: spec.titleSize,
    bodySize: spec.bodySize,
    margin: spec.margin,
    brandY: spec.brandY,
  }
}

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

  const layout = layoutFor(variant, content.cards.length)
  const images = await Promise.all(content.cards.map((card) => loadImage(card.image)))

  const background = ctx.createLinearGradient(0, 0, width, height)
  background.addColorStop(0, '#0b0918')
  background.addColorStop(0.55, '#15122a')
  background.addColorStop(1, '#0b0918')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const fontStack =
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif'
  const maxWidth = width - layout.margin * 2

  images.forEach((image, index) => {
    const box = layout.boxes[index]
    if (!box) return
    ctx.save()
    ctx.shadowColor = 'rgba(216, 177, 107, 0.35)'
    ctx.shadowBlur = 32
    ctx.strokeStyle = '#d8b16b'
    ctx.lineWidth = 3
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(box.x, box.y, box.w, box.h, 20)
    else ctx.rect(box.x, box.y, box.w, box.h)
    ctx.stroke()
    ctx.restore()

    // 逆位：整张牌转 180°，和界面上看到的一致。
    if (content.cards[index]?.reversed) {
      ctx.save()
      ctx.translate(box.x + box.w / 2, box.y + box.h / 2)
      ctx.rotate(Math.PI)
      ctx.drawImage(image, -box.w / 2, -box.h / 2, box.w, box.h)
      ctx.restore()
    } else {
      ctx.drawImage(image, box.x, box.y, box.w, box.h)
    }
  })

  // 牌位名与正逆位放在各自牌面下方
  ctx.textAlign = 'center'
  ctx.fillStyle = '#a29dbe'
  ctx.font = `400 ${Math.round(layout.bodySize * 0.82)}px ${fontStack}`
  layout.boxes.forEach((box, index) => {
    const card = content.cards[index]
    const label = card ? `${card.label}${card.reversed ? ' · 逆位' : ''}`.trim() : ''
    if (label) ctx.fillText(label, box.x + box.w / 2, box.y + box.h + 40)
  })

  const lastBox = layout.boxes[layout.boxes.length - 1]!
  let cursor = lastBox.y + lastBox.h + 104

  ctx.fillStyle = '#f1dcad'
  ctx.font = `600 ${layout.titleSize}px ${fontStack}`
  const title = content.cards.length > 1 ? content.spreadName : (content.cards[0]?.name ?? '')
  if (title) ctx.fillText(title, width / 2, cursor)

  if (content.cards.length > 1) {
    cursor += Math.round(layout.titleSize * 0.82)
    ctx.fillStyle = '#a29dbe'
    ctx.font = `300 ${Math.round(layout.titleSize * 0.52)}px ${fontStack}`
    ctx.fillText(
      content.cards.map((card) => `${card.name}${card.reversed ? '逆' : ''}`).join(' · '),
      width / 2,
      cursor,
    )
  }

  if (content.question) {
    cursor += Math.round(layout.bodySize * 2)
    ctx.fillStyle = '#d8b16b'
    ctx.font = `400 ${layout.bodySize - 3}px ${fontStack}`
    ctx.fillText(`你问的是：${summarize(content.question, 40)}`, width / 2, cursor)
  }

  cursor += Math.round(layout.bodySize * 1.9)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#e6e3f4'
  ctx.font = `400 ${layout.bodySize}px ${fontStack}`
  const lineHeight = Math.round(layout.bodySize * 1.7)
  for (const line of wrapText(summarize(content.core, 240), maxWidth, (text) =>
    ctx.measureText(text).width,
  )) {
    if (cursor > layout.brandY - lineHeight * 3) break
    ctx.fillText(line, layout.margin, cursor)
    cursor += lineHeight
  }

  cursor += 24
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
