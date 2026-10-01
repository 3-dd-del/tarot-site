import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cardsDir = path.join(root, 'public', 'img', 'cards')

const SUITS = ['wands', 'cups', 'swords', 'pentacles']
const EXPECTED_WIDTH = 800
const EXPECTED_HEIGHT = 1333
const MAX_FILE_BYTES = 512 * 1024
const MAX_TOTAL_BYTES = 25 * 1024 * 1024

/** 按命名规则推导出 78 个期望的文件名。 */
function expectedFileNames() {
  const names = []
  for (let i = 0; i <= 21; i += 1) {
    names.push(`major-${String(i).padStart(2, '0')}.webp`)
  }
  for (const suit of SUITS) {
    for (let i = 1; i <= 14; i += 1) {
      names.push(`${suit}-${String(i).padStart(2, '0')}.webp`)
    }
  }
  return names.sort()
}

/** 直接读 WebP 头拿宽高，避免为了测试引入图像处理依赖。 */
function readWebpSize(buffer) {
  assert.ok(buffer.length >= 16, '文件太小，不是完整的 WebP')
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', '缺少 RIFF 头')
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', '缺少 WEBP 标识')

  let offset = 12
  while (offset + 8 <= buffer.length) {
    const fourcc = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const data = offset + 8

    if (fourcc === 'VP8X') {
      return { width: 1 + buffer.readUIntLE(data + 4, 3), height: 1 + buffer.readUIntLE(data + 7, 3) }
    }
    if (fourcc === 'VP8 ') {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      }
    }
    if (fourcc === 'VP8L') {
      const bits = buffer.readUInt32LE(data + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    offset = data + size + (size % 2)
  }

  throw new Error('没有找到任何图像数据块')
}

const files = (await readdir(cardsDir).catch(() => {
  throw new Error(`牌面目录不存在：${cardsDir}`)
})).sort()

describe('牌面素材', () => {
  it('78 张牌齐全，文件名符合命名规则', () => {
    const webp = files.filter((name) => name.endsWith('.webp')).sort()
    assert.deepEqual(webp, expectedFileNames())
  })

  it('没有多余的杂项文件', () => {
    assert.deepEqual(
      files.filter((name) => !name.endsWith('.webp')),
      [],
    )
  })

  it('每张都是有效的 WebP，尺寸统一为 800×1333', async () => {
    for (const name of files) {
      const buffer = await readFile(path.join(cardsDir, name))
      assert.deepEqual(readWebpSize(buffer), { width: EXPECTED_WIDTH, height: EXPECTED_HEIGHT }, name)
    }
  })

  it('单张不超过 512KB，总体积不超过 25MB', async () => {
    let total = 0
    for (const name of files) {
      const info = await stat(path.join(cardsDir, name))
      assert.ok(info.size <= MAX_FILE_BYTES, `${name} 体积 ${(info.size / 1024).toFixed(0)}KB 超出预期`)
      total += info.size
    }
    assert.ok(total <= MAX_TOTAL_BYTES, `牌面总体积 ${(total / 1048576).toFixed(1)}MB 超出预期`)
  })
})

describe('素材来源记录', () => {
  it('docs/image-sources.md 记录了许可与原始来源', async () => {
    const text = await readFile(path.join(root, 'docs', 'image-sources.md'), 'utf8')
    assert.match(text, /公有领域/)
    assert.match(text, /1909/)
    assert.match(text, /steve-p\.org/)
  })
})
