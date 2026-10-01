/**
 * 生成站点图标：favicon.ico（多尺寸 PNG-in-ICO）、apple-touch-icon 与 PWA 图标。
 * 不依赖任何三方库，PNG 由 zlib 直接编码，方便在没有图像工具的环境里复现。
 *
 * 用法：node scripts/make-icon.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { deflateSync } from 'node:zlib'

const ROOT = path.resolve(import.meta.dirname, '..')
const SUPER = 3

/* ---------- PNG 编码 ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = -1
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---------- 图形 ---------- */

const GOLD = [0xd8, 0xb1, 0x6b]
const GOLD_SOFT = [0xf1, 0xdc, 0xad]
const TOP = [0x1d, 0x18, 0x40]
const BOTTOM = [0x0b, 0x09, 0x18]

function roundedRectSdf(x, y, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - radius)
  const qy = Math.abs(y - 0.5) - (0.5 - radius)
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
  )
}

function inCrescent(x, y) {
  const outer = Math.hypot(x - 0.46, y - 0.53) <= 0.27
  const cut = Math.hypot(x - 0.565, y - 0.475) <= 0.235
  return outer && !cut
}

function inSparkle(x, y) {
  const r = 0.115
  const dx = Math.abs(x - 0.67) / r
  const dy = Math.abs(y - 0.3) / r
  return Math.sqrt(dx) + Math.sqrt(dy) <= 1
}

function sample(x, y, rounded) {
  const sdf = roundedRectSdf(x, y, 0.225)
  if (rounded && sdf > 0) return [0, 0, 0, 0]

  const t = y
  let color = [
    Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
    Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
    Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t),
  ]

  if (rounded && sdf > -0.016) {
    const strength = Math.min(1, (sdf + 0.016) / 0.016)
    color = color.map((channel, index) => Math.round(channel * (1 - 0.55 * strength) + GOLD[index] * 0.55 * strength))
  }

  if (inCrescent(x, y)) color = GOLD
  if (inSparkle(x, y)) color = GOLD_SOFT

  return [...color, 255]
}

function renderRgba(size, rounded) {
  const output = Buffer.alloc(size * size * 4)
  const samples = SUPER * SUPER

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SUPER; sy += 1) {
        for (let sx = 0; sx < SUPER; sx += 1) {
          const px = (x + (sx + 0.5) / SUPER) / size
          const py = (y + (sy + 0.5) / SUPER) / size
          const [cr, cg, cb, ca] = sample(px, py, rounded)
          r += cr
          g += cg
          b += cb
          a += ca
        }
      }
      const offset = (y * size + x) * 4
      output[offset] = Math.round(r / samples)
      output[offset + 1] = Math.round(g / samples)
      output[offset + 2] = Math.round(b / samples)
      output[offset + 3] = Math.round(a / samples)
    }
  }

  return output
}

/* ---------- ICO 封装 ---------- */

function encodeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(16 * entries.length)
  let offset = header.length + directory.length

  entries.forEach((entry, index) => {
    const base = index * 16
    directory[base] = entry.size >= 256 ? 0 : entry.size
    directory[base + 1] = entry.size >= 256 ? 0 : entry.size
    directory[base + 2] = 0
    directory[base + 3] = 0
    directory.writeUInt16LE(1, base + 4)
    directory.writeUInt16LE(32, base + 6)
    directory.writeUInt32LE(entry.png.length, base + 8)
    directory.writeUInt32LE(offset, base + 12)
    offset += entry.png.length
  })

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)])
}

/* ---------- 输出 ---------- */

const PUBLIC = path.join(ROOT, 'public')
const ASSETS = path.join(ROOT, 'assets')
mkdirSync(PUBLIC, { recursive: true })
mkdirSync(ASSETS, { recursive: true })

const written = []

function writePng(target, size, rounded) {
  writeFileSync(target, encodePng(size, renderRgba(size, rounded)))
  written.push(path.relative(ROOT, target))
}

writePng(path.join(PUBLIC, 'apple-touch-icon.png'), 180, false)
writePng(path.join(PUBLIC, 'icon-192.png'), 192, false)
writePng(path.join(PUBLIC, 'icon-512.png'), 512, false)

const icoSizes = [16, 32, 48, 64, 128, 256]
const ico = encodeIco(
  icoSizes.map((size) => ({
    size,
    png: encodePng(size, renderRgba(size, true)),
  })),
)
writeFileSync(path.join(PUBLIC, 'favicon.ico'), ico)
written.push('public/favicon.ico')

// 桌面快捷方式用的图标，放在 assets 下，避免被静态资源目录清空时一起删掉。
writeFileSync(path.join(ASSETS, 'tarot.ico'), ico)
written.push('assets/tarot.ico')

console.log(`已生成图标：\n${written.map((item) => `  - ${item}`).join('\n')}`)
